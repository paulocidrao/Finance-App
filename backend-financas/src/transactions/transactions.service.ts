import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { CategoriesService } from '../categories/categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto, ListQueryDto, UpdateTransactionDto } from '../dtos';
import { parseRangeEnd, parseRangeStart } from '../date-range';
@Injectable()
export class TransactionsService {
  constructor(private db: PrismaService, private categories: CategoriesService) {}
  async create(userId: string, dto: CreateTransactionDto) { if (dto.categoryId) await this.categories.validate(userId, dto.categoryId, dto.type); return this.db.transaction.create({ data: { ...dto, userId, date: new Date(dto.date) } }); }
  async findOne(userId: string, id: string) { const item = await this.db.transaction.findFirst({ where: { id, userId } }); if (!item) throw new NotFoundException(); return item; }
  async update(userId: string, id: string, dto: UpdateTransactionDto) { const old = await this.findOne(userId, id); const type = dto.type ?? old.type; if (dto.categoryId) await this.categories.validate(userId, dto.categoryId, type); return this.db.transaction.update({ where: { id }, data: { ...dto, ...(dto.date ? { date: new Date(dto.date) } : {}) } }); }
  async remove(userId: string, id: string) { await this.findOne(userId, id); await this.db.transaction.delete({ where: { id } }); }
  async list(userId: string, q: ListQueryDto) { if (q.from && q.to && parseRangeStart(q.from) > parseRangeEnd(q.to)) throw new BadRequestException('from deve ser menor ou igual a to'); if (q.limit > 100) throw new BadRequestException('limit deve ser no máximo 100'); const where: Prisma.TransactionWhereInput = { userId, ...(q.type ? { type: q.type } : {}), ...(q.categoryId ? { categoryId: q.categoryId } : {}), ...(q.search ? { description: { contains: q.search, mode: 'insensitive' } } : {}), ...((q.from || q.to) ? { date: { ...(q.from ? { gte: parseRangeStart(q.from) } : {}), ...(q.to ? { lte: parseRangeEnd(q.to) } : {}) } } : {}) }; const [transactions, total] = await Promise.all([this.db.transaction.findMany({ where, include: { category: { select: { name: true } } }, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: [{ [q.sort]: q.order }, { createdAt: q.order }] }), this.db.transaction.count({ where })]); const data = transactions.map(({ category, ...transaction }) => ({ ...transaction, categoryName: category?.name ?? null })); return { data, meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } }; }
}
