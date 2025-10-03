import { Controller, Get, Query, UseGuards, Req, Param, Post } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('achievements')
@Controller()
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get('achievements')
  @ApiOperation({ summary: 'Obtener catálogo de logros' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'rarity', required: false })
  async getCatalog(
    @Query('category') category?: string,
    @Query('rarity') rarity?: string,
  ) {
    return this.achievementsService.getCatalog({ category, rarity });
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('users/me/achievements')
  @ApiOperation({ summary: 'Logros del usuario autenticado' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtra por estado: completed | in_progress | locked' })
  @ApiResponse({ status: 200, description: 'Lista de logros del usuario' })
  async getUserAchievements(
    @Req() req,
    @Query('status') status?: 'completed' | 'in_progress' | 'locked',
  ) {
    const userId = req.user.sub;
    return this.achievementsService.getUserAchievements(userId, status);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('users/me/achievements/recent')
  @ApiOperation({ summary: 'Logros recientes del usuario' })
  @ApiQuery({ name: 'limit', required: false, description: 'Cantidad de resultados (por defecto 5)' })
  async getRecent(@Req() req, @Query('limit') limit?: string) {
    const userId = req.user.sub;
    const take = limit ? parseInt(limit, 10) : 5;
    return this.achievementsService.getRecentAchievements(userId, take);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('users/me/achievements/:achievementId/notify')
  @ApiOperation({ summary: 'Marcar logro como notificado' })
  @ApiParam({ name: 'achievementId', description: 'ID del logro' })
  async markNotified(@Req() req, @Param('achievementId') achievementId: string) {
    const userId = req.user.sub;
    return this.achievementsService.markAchievementNotified(userId, achievementId);
  }
}
