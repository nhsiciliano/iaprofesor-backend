import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { LearningPathsService } from './learning-paths.service';

@ApiTags('learning-paths')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@Controller('learning-paths')
export class LearningPathsController {
  constructor(private readonly learningPathsService: LearningPathsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar learning paths disponibles' })
  @ApiQuery({ name: 'subjects', required: false, description: 'Filtrar por materias', type: [String] })
  @ApiQuery({ name: 'difficulty', required: false, description: 'Filtrar por dificultad', type: [String] })
  @ApiQuery({ name: 'limit', required: false, description: 'Limitar resultados' })
  @ApiQuery({ name: 'search', required: false, description: 'Búsqueda por texto' })
  async findAll(
    @Query('subjects') subjects?: string | string[],
    @Query('difficulty') difficulty?: string | string[],
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const subjectFilters = Array.isArray(subjects)
      ? subjects
      : subjects
      ? subjects.split(',')
      : undefined;

    const difficultyFilters = Array.isArray(difficulty)
      ? (difficulty as string[])
      : difficulty
      ? difficulty.split(',')
      : undefined;

    return this.learningPathsService.findAll({
      subjects: subjectFilters,
      difficulty: difficultyFilters as any,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
  }

  @Get(':pathId')
  @ApiOperation({ summary: 'Obtener detalle de un learning path' })
  @ApiParam({ name: 'pathId', description: 'ID del learning path' })
  async findOne(@Param('pathId') pathId: string) {
    return this.learningPathsService.findOne(pathId);
  }
}

@ApiTags('learning-paths')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@Controller('users/me/learning-paths')
export class UserLearningPathsController {
  constructor(private readonly learningPathsService: LearningPathsService) {}

  @Get('recommended')
  @ApiOperation({ summary: 'Learning paths recomendados para el usuario' })
  @ApiQuery({ name: 'limit', required: false })
  async getRecommended(@Req() req, @Query('limit') limit?: string) {
    const userId = req.user.sub;
    const take = limit ? parseInt(limit, 10) : 6;
    return this.learningPathsService.getRecommended(userId, take);
  }

  @Post(':pathId/enroll')
  @ApiOperation({ summary: 'Inscribir usuario en un learning path' })
  @ApiParam({ name: 'pathId', description: 'ID del learning path' })
  async enroll(@Req() req, @Param('pathId') pathId: string) {
    const userId = req.user.sub;
    return this.learningPathsService.enroll(userId, pathId);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Progreso del usuario en todos los learning paths' })
  async getAllProgress(@Req() req) {
    const userId = req.user.sub;
    return this.learningPathsService.getUserProgress(userId);
  }

  @Get(':pathId/progress')
  @ApiOperation({ summary: 'Progreso del usuario en un learning path específico' })
  @ApiParam({ name: 'pathId', description: 'ID del learning path' })
  async getProgress(@Req() req, @Param('pathId') pathId: string) {
    const userId = req.user.sub;
    return this.learningPathsService.getUserProgress(userId, pathId);
  }

  @Patch(':pathId/modules/:moduleId/progress')
  @ApiOperation({ summary: 'Actualizar progreso de un módulo' })
  @ApiParam({ name: 'pathId', description: 'ID del learning path' })
  @ApiParam({ name: 'moduleId', description: 'ID del módulo' })
  @ApiResponse({ status: 200, description: 'Progreso actualizado' })
  async updateModuleProgress(
    @Req() req,
    @Param('pathId') pathId: string,
    @Param('moduleId') moduleId: string,
    @Body() body: { progress: number; timeSpent?: number; score?: number },
  ) {
    const userId = req.user.sub;
    return this.learningPathsService.updateModuleProgress(userId, pathId, moduleId, body);
  }
}
