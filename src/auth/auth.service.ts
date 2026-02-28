import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseClient } from '@supabase/supabase-js';

export interface JwtUserPayload {
  sub: string;
  email: string | null;
  user_metadata: Record<string, unknown> | null;
}

/**
 * ARQUITECTURA BACKEND-FOCUSED:
 * - Backend solo maneja validación de JWT
 * - Frontend maneja auth directamente con Supabase
 * - Backend sirve datos protegidos y lógica de negocio
 */

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private supabase: SupabaseClient;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      this.configService.get<string>('SUPABASE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new InternalServerErrorException('Supabase configuration is missing');
    }

    // Cliente Supabase para validaciones del lado servidor
    this.supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false, // No manejar refresh en backend
          persistSession: false,   // No persistir sesión en backend
        },
      },
    );
  }

  /**
   * Validar JWT token de Supabase
   * Usado por la estrategia JWT
   */
  async validateToken(token: string): Promise<JwtUserPayload | null> {
    try {
      const { data, error } = await this.supabase.auth.getUser(token);

      if (error) {
        return null;
      }
      
      if (!data.user) {
        return null;
      }

      return {
        sub: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      };
    } catch {
      return null;
    }
  }

  /**
   * Obtener o crear perfil de usuario en la base de datos local
   * Llamado cuando se necesitan datos adicionales
   */
  async getOrCreateUserProfile(userId: string, email: string, fullName?: string) {
    try {
      // Intentar obtener usuario existente
      let user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      // Si no existe, crear uno nuevo
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            id: userId,
            email: email,
            fullName: fullName || email.split('@')[0], // Fallback al nombre del email
          },
        });
      }

      return user;
    } catch (error) {
      this.logger.error('Error managing user profile', error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Error al gestionar perfil de usuario');
    }
  }

  /**
   * Obtener información del usuario autenticado
   * Incluye datos de Supabase + datos locales
   */
  async getCurrentUser(userId: string) {
    try {
      const localUser = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      return {
        id: userId,
        ...localUser,
      };
    } catch (error) {
      this.logger.error('Error fetching current user', error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Error al obtener el usuario actual');
    }
  }

  // Métodos legacy - mantener para compatibilidad pero deprecar
  /**
   * @deprecated Use frontend Supabase auth directly
   */
  async signUp(email: string, password: string, _fullName: string) {
    this.logger.warn('AuthService.signUp is deprecated. Use frontend Supabase auth.');
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return data;
  }

  /**
   * @deprecated Use frontend Supabase auth directly
   */
  async login(email: string, password: string) {
    this.logger.warn('AuthService.login is deprecated. Use frontend Supabase auth.');
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new UnauthorizedException(error.message);
    }
    return data;
  }
}
