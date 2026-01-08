import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma, UserLearningPath as PrismaUserLearningPath } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
type ModuleType = 'lesson' | 'practice' | 'quiz' | 'discussion' | 'project';
type ModuleContentType = 'text' | 'conversation' | 'quiz' | 'interactive';
type PathStatus = 'not_started' | 'in_progress' | 'completed' | 'paused';
type ModuleStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'failed';

type ModuleContent = {
  type: ModuleContentType;
  title: string;
  description: string;
  instructions?: string;
  prompts?: string[];
  resources?: Resource[];
};

type Resource = {
  id: string;
  title: string;
  type: 'link' | 'document' | 'video' | 'image';
  url: string;
  description?: string;
};

type LearningModule = {
  id: string;
  pathId: string;
  title: string;
  description: string;
  order: number;
  estimatedDuration: number;
  type: ModuleType;
  content: ModuleContent;
  isRequired: boolean;
  prerequisites: string[];
};

type LearningPath = {
  id: string;
  title: string;
  description: string;
  subject: string;
  difficulty: SkillLevel;
  estimatedDuration: number;
  prerequisites: string[];
  learningObjectives: string[];
  modules: LearningModule[];
  tags: string[];
  isRecommended: boolean;
  enrollmentCount: number;
  averageRating: number;
  createdAt: string;
  updatedAt: string;
};

type ModuleProgress = {
  moduleId: string;
  status: ModuleStatus;
  progress: number;
  timeSpent: number;
  score?: number;
  attempts: number;
  completedAt?: string;
  lastAttemptAt?: string;
};

type UserPathProgress = {
  id: string;
  userId: string;
  pathId: string;
  status: PathStatus;
  progress: number;
  currentModuleId?: string;
  completedModules: string[];
  startedAt: string;
  lastActivityAt: string;
  completedAt?: string;
  totalTimeSpent: number;
  moduleProgress: ModuleProgress[];
  score?: number;
};

type SeedLearningModule = {
  id: string;
  title: string;
  description: string;
  order: number;
  estimatedDuration: number;
  type: ModuleType;
  content: ModuleContent;
  prerequisites?: string[];
  isRequired?: boolean;
};

type SeedLearningPath = {
  id: string;
  title: string;
  description: string;
  subject: string;
  difficulty: SkillLevel;
  estimatedDuration: number;
  prerequisites: string[];
  learningObjectives: string[];
  modules: SeedLearningModule[];
  tags: string[];
  isRecommended: boolean;
  enrollmentCount: number;
  averageRating: number;
};

interface FilterOptions {
  subjects?: string[];
  difficulty?: SkillLevel[];
  limit?: number;
  search?: string;
}

@Injectable()
export class LearningPathsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.learningPath.count();
    if (count === 0) {
      await this.seedDefaults();
    }
  }

  async findAll(filters?: FilterOptions): Promise<LearningPath[]> {
    const where: Prisma.LearningPathWhereInput = {};

    if (filters?.subjects?.length) {
      where.subject = { in: filters.subjects };
    }

    if (filters?.difficulty?.length) {
      where.difficulty = { in: filters.difficulty };
    }

    if (filters?.search) {
      const query = filters.search;
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { tags: { has: query } },
      ];
    }

    const paths = await this.prisma.learningPath.findMany({
      where,
      include: {
        modules: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: filters?.limit,
    });

    return paths.map((path) => this.mapLearningPath(path));
  }

  async findOne(pathId: string): Promise<LearningPath> {
    const path = await this.prisma.learningPath.findUnique({
      where: { id: pathId },
      include: {
        modules: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!path) {
      throw new NotFoundException('Learning path not found');
    }

    return this.mapLearningPath(path);
  }

  async getRecommended(userId: string, limit = 6): Promise<LearningPath[]> {
    const [recommended, enrolled] = await Promise.all([
      this.prisma.learningPath.findMany({
        where: { isRecommended: true },
        include: { modules: { orderBy: { order: 'asc' } } },
      }),
      this.prisma.userLearningPath.findMany({
        where: { userId },
        select: { pathId: true },
      }),
    ]);

    const enrolledSet = new Set(enrolled.map((item) => item.pathId));
    return recommended
      .filter((path) => !enrolledSet.has(path.id))
      .slice(0, limit)
      .map((path) => this.mapLearningPath(path));
  }

  async enroll(userId: string, pathId: string): Promise<UserPathProgress> {
    const existing = await this.prisma.userLearningPath.findUnique({
      where: { userId_pathId: { userId, pathId } },
    });

    if (existing) {
      return this.mapUserLearningPath(existing);
    }

    const path = await this.prisma.learningPath.findUnique({
      where: { id: pathId },
      include: { modules: { orderBy: { order: 'asc' } } },
    });

    if (!path) {
      throw new NotFoundException('Learning path not found');
    }

    const moduleProgress = path.modules.map((module, index) => ({
      moduleId: module.id,
      status: index === 0 ? 'available' : 'locked',
      progress: 0,
      timeSpent: 0,
      attempts: 0,
    }));

    const record = await this.prisma.userLearningPath.create({
      data: {
        userId,
        pathId,
        status: 'in_progress',
        progress: 0,
        currentModuleId: moduleProgress[0]?.moduleId,
        completedModules: [],
        moduleProgress: moduleProgress as Prisma.JsonValue,
      },
    });

    await this.prisma.learningPath.update({
      where: { id: pathId },
      data: { enrollmentCount: { increment: 1 } },
    });

    return this.mapUserLearningPath(record);
  }

  async getUserProgress(userId: string, pathId?: string): Promise<UserPathProgress[]> {
    const records = await this.prisma.userLearningPath.findMany({
      where: {
        userId,
        ...(pathId ? { pathId } : {}),
      },
      orderBy: { startedAt: 'desc' },
    });

    return records.map((record) => this.mapUserLearningPath(record));
  }

  async updateModuleProgress(
    userId: string,
    pathId: string,
    moduleId: string,
    payload: { progress: number; timeSpent?: number; score?: number },
  ): Promise<UserPathProgress> {
    const record = await this.prisma.userLearningPath.findUnique({
      where: { userId_pathId: { userId, pathId } },
      include: {
        path: {
          include: { modules: { orderBy: { order: 'asc' } } },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('No enrollment for this learning path');
    }

    const moduleProgress = this.parseModuleProgress(record.moduleProgress);
    const index = moduleProgress.findIndex((module) => module.moduleId === moduleId);
    if (index === -1) {
      moduleProgress.push({
        moduleId,
        status: 'available',
        progress: 0,
        timeSpent: 0,
        attempts: 0,
      });
    }

    const entry = moduleProgress.find((module) => module.moduleId === moduleId)!;
    entry.status = payload.progress >= 100 ? 'completed' : 'in_progress';
    entry.progress = Math.min(100, Math.max(0, payload.progress));
    entry.lastAttemptAt = new Date().toISOString();
    entry.attempts += 1;

    if (payload.timeSpent) {
      entry.timeSpent += payload.timeSpent;
    }

    if (payload.score !== undefined) {
      entry.score = payload.score;
    }

    if (entry.status === 'completed' && !entry.completedAt) {
      entry.completedAt = new Date().toISOString();
    }

    const completedModules = new Set(record.completedModules ?? []);
    if (entry.status === 'completed') {
      completedModules.add(moduleId);
      const orderedIds = record.path?.modules
        ?.slice()
        .sort((a, b) => a.order - b.order)
        .map((module) => module.id);

      if (orderedIds) {
        const currentIndex = orderedIds.indexOf(moduleId);
        const nextId = orderedIds[currentIndex + 1];
        const nextModule = moduleProgress.find((module) => module.moduleId === nextId);
        if (nextModule && nextModule.status === 'locked') {
          nextModule.status = 'available';
        }
      }
    }

    const allCompleted = moduleProgress.every((module) => module.status === 'completed');
    const progressPercentage = moduleProgress.length > 0
      ? Math.round((Array.from(completedModules).length / moduleProgress.length) * 100)
      : 0;

    const nextModule = moduleProgress.find((module) => module.status === 'available');
    const totalTimeSpent = record.totalTimeSpent + (payload.timeSpent ?? 0);

    const updated = await this.prisma.userLearningPath.update({
      where: { id: record.id },
      data: {
        moduleProgress: moduleProgress as Prisma.JsonValue,
        completedModules: Array.from(completedModules),
        totalTimeSpent,
        lastActivityAt: new Date(),
        currentModuleId: allCompleted ? moduleId : nextModule?.moduleId ?? moduleId,
        progress: progressPercentage,
        status: allCompleted ? 'completed' : 'in_progress',
        completedAt: allCompleted ? (record.completedAt ?? new Date()) : null,
        score: payload.score ?? record.score,
      },
    });

    return this.mapUserLearningPath(updated);
  }

  private mapLearningPath(
    record: Prisma.LearningPathGetPayload<{ include: { modules: true } }>,
  ): LearningPath {
    return {
      id: record.id,
      title: record.title,
      description: record.description,
      subject: record.subject,
      difficulty: record.difficulty as SkillLevel,
      estimatedDuration: record.estimatedDuration,
      prerequisites: record.prerequisites,
      learningObjectives: record.learningObjectives,
      modules: record.modules
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((module) => ({
          id: module.id,
          pathId: module.pathId,
          title: module.title,
          description: module.description,
          order: module.order,
          estimatedDuration: module.estimatedDuration,
          type: module.type as ModuleType,
          content: (module.content as ModuleContent) ?? {
            type: 'text',
            title: module.title,
            description: module.description,
          },
          isRequired: module.isRequired,
          prerequisites: module.prerequisites ?? [],
        })),
      tags: record.tags,
      isRecommended: record.isRecommended,
      enrollmentCount: record.enrollmentCount,
      averageRating: record.averageRating,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapUserLearningPath(record: PrismaUserLearningPath): UserPathProgress {
    return {
      id: record.id,
      userId: record.userId,
      pathId: record.pathId,
      status: record.status as PathStatus,
      progress: record.progress,
      currentModuleId: record.currentModuleId ?? undefined,
      completedModules: record.completedModules ?? [],
      startedAt: record.startedAt.toISOString(),
      lastActivityAt: record.lastActivityAt.toISOString(),
      completedAt: record.completedAt ? record.completedAt.toISOString() : undefined,
      totalTimeSpent: record.totalTimeSpent,
      moduleProgress: this.parseModuleProgress(record.moduleProgress),
      score: record.score ?? undefined,
    };
  }

  private parseModuleProgress(data: Prisma.JsonValue | null): ModuleProgress[] {
    if (!data || !Array.isArray(data)) {
      return [];
    }

    return (data as ModuleProgress[]).map((module) => ({
      moduleId: module.moduleId,
      status: module.status ?? 'available',
      progress: module.progress ?? 0,
      timeSpent: module.timeSpent ?? 0,
      score: module.score,
      attempts: module.attempts ?? 0,
      completedAt: module.completedAt,
      lastAttemptAt: module.lastAttemptAt,
    }));
  }

  private async seedDefaults() {
    const seeds = this.seedPaths();

    for (const path of seeds) {
      await this.prisma.learningPath.create({
        data: {
          id: path.id,
          title: path.title,
          description: path.description,
          subject: path.subject,
          difficulty: path.difficulty,
          estimatedDuration: path.estimatedDuration,
          tags: path.tags,
          isRecommended: path.isRecommended,
          enrollmentCount: path.enrollmentCount,
          averageRating: path.averageRating,
          prerequisites: path.prerequisites,
          learningObjectives: path.learningObjectives,
          modules: {
            create: path.modules.map((module) => ({
              id: module.id,
              title: module.title,
              description: module.description,
              order: module.order,
              estimatedDuration: module.estimatedDuration,
              type: module.type,
              content: module.content as Prisma.JsonValue,
              isRequired: module.isRequired ?? true,
              prerequisites: module.prerequisites ?? [],
            })),
          },
        },
      });
    }
  }

  private seedPaths(): SeedLearningPath[] {
    return [
      {
        id: 'math-foundations',
        title: 'Fundamentos de Matemática',
        description: 'Construye una base sólida en aritmética, álgebra básica y resolución de problemas.',
        subject: 'mathematics',
        difficulty: 'beginner',
        estimatedDuration: 12,
        tags: ['matemática', 'álgebra', 'principiantes'],
        isRecommended: true,
        enrollmentCount: 1820,
        averageRating: 4.7,
        prerequisites: ['Operaciones básicas'],
        learningObjectives: [
          'Comprender operaciones aritméticas esenciales',
          'Introducir el pensamiento algebraico',
          'Aplicar estrategias de resolución de problemas',
        ],
        modules: [
          {
            id: 'math-foundations-module-1',
            title: 'Aritmética esencial',
            description: 'Repaso de operaciones básicas, fracciones y porcentajes.',
            order: 1,
            estimatedDuration: 60,
            type: 'lesson',
            content: {
              type: 'text',
              title: 'Conceptos clave de aritmética',
              description: 'Material teórico e interactivo para refrescar aritmética.',
              resources: [
                {
                  id: 'res-1',
                  title: 'Guía visual de fracciones',
                  type: 'document',
                  url: 'https://example.com/fracciones.pdf',
                },
              ],
            },
          },
          {
            id: 'math-foundations-module-2',
            title: 'Introducción al álgebra',
            description: 'Expresiones algebraicas, ecuaciones simples y patrones.',
            order: 2,
            estimatedDuration: 75,
            type: 'practice',
            content: {
              type: 'interactive',
              title: 'Resolver ecuaciones paso a paso',
              description: 'Ejercicios guiados con retroalimentación inmediata.',
            },
          },
          {
            id: 'math-foundations-module-3',
            title: 'Resolución de problemas',
            description: 'Estrategias para abordar problemas matemáticos cotidianos.',
            order: 3,
            estimatedDuration: 90,
            type: 'project',
            content: {
              type: 'conversation',
              title: 'Laboratorio de problemas',
              description: 'Actividades guiadas con el tutor IA para practicar pensamiento lógico.',
              prompts: [
                'Describe el problema en tus propias palabras',
                'Identifica la información conocida y desconocida',
              ],
            },
          },
        ],
      },
      {
        id: 'history-latin-america',
        title: 'Historia de América Latina: Siglo XX',
        description: 'Explora los eventos clave que marcaron el siglo XX en América Latina.',
        subject: 'history',
        difficulty: 'intermediate',
        estimatedDuration: 10,
        tags: ['historia', 'latinoamérica', 'política'],
        isRecommended: true,
        enrollmentCount: 940,
        averageRating: 4.6,
        prerequisites: ['Historia mundial básica'],
        learningObjectives: [
          'Comprender los procesos políticos y sociales clave',
          'Analizar consecuencias de los principales eventos',
          'Desarrollar pensamiento crítico sobre fuentes históricas',
        ],
        modules: [
          {
            id: 'history-latin-america-module-1',
            title: 'Revoluciones y movimientos sociales',
            description: 'Introducción a las revoluciones en México, Cuba y otros países.',
            order: 1,
            estimatedDuration: 70,
            type: 'lesson',
            content: {
              type: 'text',
              title: 'Contexto político del siglo XX',
              description: 'Cronologías y mapas interactivos.',
            },
          },
          {
            id: 'history-latin-america-module-2',
            title: 'Dictaduras y transiciones a la democracia',
            description: 'Análisis de los regímenes autoritarios y sus impactos.',
            order: 2,
            estimatedDuration: 80,
            type: 'discussion',
            content: {
              type: 'conversation',
              title: 'Debates guiados',
              description: 'Preguntas socráticas para analizar causas y consecuencias.',
              prompts: [
                '¿Qué factores facilitaron el ascenso de las dictaduras?'
              ],
            },
          },
          {
            id: 'history-latin-america-module-3',
            title: 'Economía y cultura',
            description: 'Cambios económicos, culturales y sociales en la región.',
            order: 3,
            estimatedDuration: 60,
            type: 'project',
            content: {
              type: 'interactive',
              title: 'Investigación temática',
              description: 'Proyecto final con presentación de hallazgos.',
            },
          },
        ],
      },
    ];
  }
}
