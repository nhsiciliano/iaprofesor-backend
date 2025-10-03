import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * ARQUITECTURA BACKEND-FOCUSED:
 * - Backend solo maneja validación de JWT
 * - Frontend maneja auth directamente con Supabase
 * - Backend sirve datos protegidos y lógica de negocio
 */

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    // Cliente Supabase para validaciones del lado servidor
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL'),
      this.configService.get<string>('SUPABASE_KEY'),
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
  async validateToken(token: string) {
    console.log('AuthService - Validating token with Supabase...');
    try {
      const { data, error } = await this.supabase.auth.getUser(token);
      
      console.log('AuthService - Supabase response:', { 
        hasUser: !!data.user, 
        error: error?.message || 'none',
        userId: data.user?.id,
        email: data.user?.email 
      });
      
      if (error) {
        console.error('AuthService - Supabase auth error:', error.message);
        return null;
      }
      
      if (!data.user) {
        console.error('AuthService - No user data returned from Supabase');
        return null;
      }

      return {
        sub: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
        ...data.user,
      };
    } catch (error) {
      console.error('AuthService - Exception during token validation:', error.message);
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
      console.error('Error managing user profile:', error);
      throw new Error('Error al gestionar perfil de usuario');
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
      console.error('Error fetching current user:', error);
      return null;
    }
  }

  // Métodos legacy - mantener para compatibilidad pero deprecar
  /**
   * @deprecated Use frontend Supabase auth directly
   */
  async signUp(email: string, password: string, _fullName: string) {
    console.warn('AuthService.signUp is deprecated. Use frontend Supabase auth.');
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * @deprecated Use frontend Supabase auth directly
   */
  async login(email: string, password: string) {
    console.warn('AuthService.login is deprecated. Use frontend Supabase auth.');
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new Error(error.message);
    }
    return data;
  }
}
