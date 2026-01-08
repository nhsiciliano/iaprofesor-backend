import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';

@Injectable()
export class NotesService {
    constructor(private prisma: PrismaService) { }

    async create(userId: string, createNoteDto: CreateNoteDto) {
        return this.prisma.note.create({
            data: {
                content: createNoteDto.content,
                tags: createNoteDto.tags || [],
                subjectId: createNoteDto.subjectId,
                sessionId: createNoteDto.sessionId,
                userId,
            },
        });
    }

    async findAll(userId: string, subjectId?: string) {
        return this.prisma.note.findMany({
            where: {
                userId,
                ...(subjectId ? { subjectId } : {}),
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async findOne(userId: string, id: string) {
        return this.prisma.note.findFirst({
            where: {
                id,
                userId,
            },
        });
    }

    async remove(userId: string, id: string) {
        return this.prisma.note.deleteMany({
            where: {
                id,
                userId,
            },
        });
    }
}
