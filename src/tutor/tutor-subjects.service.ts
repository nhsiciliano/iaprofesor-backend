import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubjectConfig } from './tutor.types';

@Injectable()
export class TutorSubjectsService implements OnModuleInit {
  private readonly logger = new Logger(TutorSubjectsService.name);
  private readonly subjects: Map<string, SubjectConfig> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.loadSubjects();
  }

  async loadSubjects() {
    try {
      const subjects = await this.prisma.subject.findMany({
        where: { isActive: true },
      });

      this.subjects.clear();
      subjects.forEach((subject) => {
        this.subjects.set(subject.id, {
          name: subject.name,
          systemPrompt: subject.systemPrompt,
          difficulty: subject.difficulty,
          concepts: subject.concepts,
        });
      });

      this.logger.log(`Loaded ${this.subjects.size} subjects from database`);
    } catch (error) {
      this.logger.error('Failed to load subjects from database', error instanceof Error ? error.stack : undefined);
    }
  }

  async updateSubject(
    id: string,
    data: Partial<SubjectConfig> & { isActive?: boolean },
  ) {
    const updatedSubject = await this.prisma.subject.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    if (updatedSubject.isActive) {
      this.subjects.set(updatedSubject.id, {
        name: updatedSubject.name,
        systemPrompt: updatedSubject.systemPrompt,
        difficulty: updatedSubject.difficulty,
        concepts: updatedSubject.concepts,
      });
    } else {
      this.subjects.delete(updatedSubject.id);
    }

    return updatedSubject;
  }

  getSubjectDifficulty(subjectId: string): string | undefined {
    return this.subjects.get(subjectId)?.difficulty;
  }

  hasSubject(subjectId: string): boolean {
    return this.subjects.has(subjectId);
  }

  findConcepts(subjectId: string | undefined, lowerContent: string): string[] {
    if (!subjectId || !this.subjects.has(subjectId)) {
      return [];
    }

    const subjectConcepts = this.subjects.get(subjectId)?.concepts ?? [];
    return subjectConcepts.filter((concept) => lowerContent.includes(concept.toLowerCase()));
  }

  getSystemPrompt(subject?: string, needsGuidance?: boolean): string {
    if (subject && this.subjects.has(subject)) {
      const config = this.subjects.get(subject);
      let prompt = config?.systemPrompt ?? '';

      if (needsGuidance) {
        prompt +=
          '\n\nEl estudiante parece necesitar mas orientacion. Se mas especifico en tus preguntas guia.';
      }

      return prompt;
    }

    return "Eres 'IA Profesor', un tutor socratico.Haz preguntas guia para ayudar al estudiante a descubrir las respuestas por si mismo.";
  }

  async getAvailableSubjects() {
    return Array.from(this.subjects.entries()).map(([id, config]) => ({
      id,
      name: config.name,
      difficulty: config.difficulty,
      concepts: config.concepts,
    }));
  }

  async getAllSubjectsForAdmin() {
    return this.prisma.subject.findMany({
      orderBy: { name: 'asc' },
    });
  }
}
