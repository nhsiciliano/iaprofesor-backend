import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Req, Query, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersStatsService } from './users-stats.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CreateGoalDto, GoalStatus } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { UpdateGoalStatusDto } from './dto/update-goal-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { Prisma } from '@prisma/client';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard())
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly usersStatsService: UsersStatsService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Return user profile.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getMe(@Req() req) {
    // req.user is the payload from the JWT
    const userId = req.user.sub;
    return this.usersService.getMe(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'User profile updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async updateMe(@Req() req, @Body() updateUserDto: UpdateUserDto) {
    const userId = req.user.sub;
    return this.usersService.updateMe(userId, updateUserDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user profile by id' })
  @ApiParam({ name: 'id', description: 'User id' })
  @ApiResponse({ status: 200, description: 'Return user profile.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getUserById(@Req() req, @Param('id') id: string) {
    return this.usersService.getUserById(req.user.sub, id, req.user.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile by id' })
  @ApiParam({ name: 'id', description: 'User id' })
  @ApiResponse({ status: 200, description: 'User profile updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async updateUserById(
    @Req() req,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUserById(req.user.sub, id, req.user.role, updateUserDto);
  }

  @Get('me/profile')
  @ApiOperation({ summary: 'Get extended user profile' })
  @ApiResponse({ status: 200, description: 'Return extended user profile.' })
  async getProfile(@Req() req) {
    const userId = req.user.sub;
    const [user, profile, stats] = await Promise.all([
      this.usersService.getMe(userId),
      this.usersService.getUserProfile(userId),
      this.usersStatsService.getUserStats(userId),
    ]);

    const preferences = this.resolvePreferences(profile?.preferences);
    const mappedStats = this.mapStats(stats);

    return {
      id: profile?.id ?? `profile-${userId}`,
      userId,
      role: user?.role,
      displayName: profile?.displayName ?? user?.fullName ?? user?.email ?? 'Estudiante',
      bio: profile?.bio ?? '',
      avatar: profile?.avatar ?? undefined,
      preferences,
      stats: mappedStats,
      createdAt: profile?.createdAt?.toISOString(),
      updatedAt: profile?.updatedAt?.toISOString(),
    };
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update extended user profile' })
  @ApiResponse({ status: 200, description: 'User profile updated successfully.' })
  async updateProfile(@Req() req, @Body() updateProfileDto: UpdateUserProfileDto) {
    const userId = req.user.sub;
    const profile = await this.usersService.upsertUserProfile(userId, updateProfileDto);

    if (updateProfileDto.displayName) {
      await this.usersService.updateMe(userId, { displayName: updateProfileDto.displayName });
    }

    const stats = await this.usersStatsService.getUserStats(userId);
    const preferences = this.resolvePreferences(profile.preferences);
    const mappedStats = this.mapStats(stats);

    return {
      id: profile.id,
      userId,
      role: req.user.role,
      displayName: profile.displayName ?? undefined,
      bio: profile.bio ?? '',
      avatar: profile.avatar ?? undefined,
      preferences,
      stats: mappedStats,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  @Post('profile')
  @ApiOperation({ summary: 'Create or update a user profile record (legacy)' })
  @ApiResponse({ status: 201, description: 'Profile created or updated.' })
  async createProfile(@Req() req, @Body() payload: CreateUserProfileDto) {
    const userId = req.user.sub;
    if (payload.userId !== userId) {
      return this.usersService.getUserById(userId, payload.userId, req.user.role);
    }

    await this.usersService.updateMe(userId, { fullName: payload.fullName });

    const profile = await this.usersService.upsertUserProfile(userId, {
      displayName: payload.fullName,
    });

    return {
      id: profile.id,
      userId,
      displayName: profile.displayName ?? payload.fullName,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Obtener estadísticas del usuario' })
  @ApiResponse({ status: 200, description: 'Estadísticas del usuario obtenidas exitosamente' })
  async getUserStats(@Req() req) {
    const userId = req.user.sub;
    return this.usersStatsService.getUserStats(userId);
  }

  @Get('me/dashboard')
  @ApiOperation({ summary: 'Obtener datos completos del dashboard' })
  @ApiResponse({ status: 200, description: 'Datos del dashboard obtenidos exitosamente' })
  async getDashboardData(@Req() req) {
    const userId = req.user.sub;
    const [stats, progress] = await Promise.all([
      this.usersStatsService.getUserStats(userId),
      this.usersStatsService.getDetailedProgress(userId)
    ]);
    
    return {
      stats,
      progress: progress.subjectProgress,
      dailyActivity: progress.dailyActivity,
      recentAchievements: [], // TODO: Implementar achievements
      activeGoals: [] // TODO: Implementar goals
    };
  }

  @Get('me/progress')
  @ApiOperation({ summary: 'Obtener progreso detallado del usuario' })
  @ApiResponse({ status: 200, description: 'Progreso detallado obtenido exitosamente' })
  async getDetailedProgress(@Req() req) {
    const userId = req.user.sub;
    return this.usersStatsService.getDetailedProgress(userId);
  }

  @Get('me/sessions/recent')
  @ApiOperation({ summary: 'Obtener sesiones recientes del usuario' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'subject', required: false })
  async getRecentSessions(
    @Req() req,
    @Query('limit') limit?: string,
    @Query('subject') subject?: string,
  ) {
    const userId = req.user.sub;
    const take = limit ? parseInt(limit, 10) : 10;
    return this.usersStatsService.getRecentSessions(userId, take, subject);
  }

  @Get('me/analytics')
  @ApiOperation({ summary: 'Obtener analytics agregados del usuario' })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'year', 'all'], default: 'month' })
  @ApiQuery({ name: 'subjects', required: false })
  async getAnalytics(
    @Req() req,
    @Query('period') period: 'week' | 'month' | 'year' | 'all' = 'month',
    @Query('subjects') subjects?: string,
  ) {
    const userId = req.user.sub;
    const subjectList = subjects ? subjects.split(',') : undefined;
    return this.usersStatsService.getAnalyticsData(userId, period, subjectList);
  }

  @Get('me/charts/:chartType')
  @ApiOperation({ summary: 'Obtener datos para gráficos específicos' })
  @ApiParam({ name: 'chartType', enum: ['sessions', 'messages', 'study_time', 'subjects'] })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'year', 'all'], default: 'month' })
  async getChartData(
    @Req() req,
    @Param('chartType') chartType: 'sessions' | 'messages' | 'study_time' | 'subjects',
    @Query('period') period: 'week' | 'month' | 'year' | 'all' = 'month',
  ) {
    const userId = req.user.sub;
    return this.usersStatsService.getChartData(userId, chartType, period);
  }

  @Post('me/activity')
  @ApiOperation({ summary: 'Registrar actividad del usuario' })
  @ApiResponse({ status: 201, description: 'Actividad registrada exitosamente' })
  async trackUserActivity(@Req() req, @Body() activityData: any) {
    const userId = req.user.sub;
    // Por ahora solo logeamos la actividad, luego podemos implementar persistencia
    console.log(`User ${userId} activity:`, activityData);
    return { message: 'Activity tracked successfully', timestamp: new Date().toISOString() };
  }

  @Get('me/goals')
  @ApiOperation({ summary: 'Obtener objetivos del usuario' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrar por estado' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limitar cantidad de resultados' })
  @ApiResponse({ status: 200, description: 'Objetivos obtenidos exitosamente' })
  async getUserGoals(
    @Req() req,
    @Query('status') status?: string,
    @Query('limit') limit?: string
  ) {
    const userId = req.user.sub;
    const goals = await this.usersService.getGoals(
      userId,
      status,
      limit ? parseInt(limit, 10) : undefined,
    );

    return goals.map((goal) => this.mapGoal(goal));
  }

  @Post('me/goals')
  @ApiOperation({ summary: 'Crear un objetivo' })
  @ApiResponse({ status: 201, description: 'Objetivo creado exitosamente' })
  async createGoal(@Req() req, @Body() createGoalDto: CreateGoalDto) {
    const userId = req.user.sub;
    const goal = await this.usersService.createGoal(userId, createGoalDto);
    return this.mapGoal(goal);
  }

  @Patch('me/goals/:goalId')
  @ApiOperation({ summary: 'Actualizar un objetivo' })
  @ApiParam({ name: 'goalId', description: 'ID del objetivo' })
  async updateGoal(
    @Req() req,
    @Param('goalId') goalId: string,
    @Body() updateGoalDto: UpdateGoalDto,
  ) {
    const userId = req.user.sub;
    const goal = await this.usersService.updateGoal(userId, goalId, updateGoalDto);
    return this.mapGoal(goal);
  }

  @Post('me/goals/:goalId/complete')
  @ApiOperation({ summary: 'Marcar objetivo como completado' })
  @ApiParam({ name: 'goalId', description: 'ID del objetivo' })
  async completeGoal(@Req() req, @Param('goalId') goalId: string) {
    const userId = req.user.sub;
    const goal = await this.usersService.completeGoal(userId, goalId);
    return this.mapGoal(goal);
  }

  @Patch('me/goals/:goalId/status')
  @ApiOperation({ summary: 'Cambiar estado de un objetivo' })
  @ApiParam({ name: 'goalId', description: 'ID del objetivo' })
  async toggleGoalStatus(
    @Req() req,
    @Param('goalId') goalId: string,
    @Body() updateStatusDto: UpdateGoalStatusDto,
  ) {
    const userId = req.user.sub;
    const goal = await this.usersService.toggleGoalStatus(userId, goalId, updateStatusDto.status as GoalStatus);
    return this.mapGoal(goal);
  }

  @Delete('me/goals/:goalId')
  @ApiOperation({ summary: 'Eliminar un objetivo' })
  @ApiParam({ name: 'goalId', description: 'ID del objetivo' })
  @ApiResponse({ status: 200, description: 'Objetivo eliminado' })
  async deleteGoal(@Req() req, @Param('goalId') goalId: string) {
    const userId = req.user.sub;
    await this.usersService.deleteGoal(userId, goalId);
    return { success: true };
  }

  private mapGoal(goal: Prisma.GoalGetPayload<{ include: { milestones: true } }>) {
    const progress = goal.targetValue > 0
      ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
      : 0;

    return {
      id: goal.id,
      userId: goal.userId,
      title: goal.title,
      description: goal.description,
      type: goal.type,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      status: goal.status,
      priority: goal.priority,
      category: goal.category ?? 'learning',
      subject: goal.subject ?? undefined,
      deadline: goal.deadline ? goal.deadline.toISOString() : undefined,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
      completedAt: goal.completedAt ? goal.completedAt.toISOString() : undefined,
      progress,
      milestones: (goal.milestones ?? []).map((milestone) => ({
        id: milestone.id,
        goalId: goal.id,
        title: milestone.title,
        description: milestone.description ?? '',
        targetValue: milestone.targetValue,
        isCompleted: milestone.isCompleted,
        completedAt: milestone.completedAt ? milestone.completedAt.toISOString() : undefined,
        order: milestone.order,
      })),
      isCustom: goal.type === 'custom',
    };
  }

  private resolvePreferences(rawPreferences?: any) {
    const defaults = {
      language: 'es',
      timezone: 'UTC',
      notifications: {
        email: true,
        push: false,
        reminders: true,
      },
      learningStyle: 'visual',
      difficultyPreference: 'beginner',
      subjectsOfInterest: [],
    };

    if (!rawPreferences || typeof rawPreferences !== 'object') {
      return defaults;
    }

    return {
      ...defaults,
      ...rawPreferences,
      notifications: {
        ...defaults.notifications,
        ...(rawPreferences.notifications ?? {}),
      },
      subjectsOfInterest: Array.isArray(rawPreferences.subjectsOfInterest)
        ? rawPreferences.subjectsOfInterest
        : defaults.subjectsOfInterest,
    };
  }

  private mapStats(stats: any) {
    return {
      totalSessions: Number(stats?.sessionsCompleted ?? 0),
      totalMessages: Number(stats?.messagesSent ?? 0),
      conceptsLearned: Number(stats?.conceptsLearned ?? 0),
      achievementsUnlocked: Number(stats?.achievementsUnlocked ?? 0),
      streakDays: Number(stats?.currentStreak ?? 0),
      totalStudyTime: Number(stats?.studyTimeMinutes ?? 0),
      averageSessionDuration: Number(stats?.averageSessionDuration ?? 0),
      favoriteSubjects: Array.isArray(stats?.favoriteSubjects) ? stats.favoriteSubjects : [],
      lastActiveDate: stats?.lastActivity ?? undefined,
    };
  }

}
