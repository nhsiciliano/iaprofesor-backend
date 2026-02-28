import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { AuthService } from './auth.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly authService: AuthService,
  ) {
    super();
  }

  async validate(req: Request) {
    // Extraer el token raw del header Authorization
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Token no encontrado');
    }

    // Validar token con Supabase
    const user = await this.authService.validateToken(token);

    if (!user) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    // Crear/actualizar perfil local si es necesario
    let role = 'user';
    try {
      const resolvedEmail = user.email ?? `${user.sub}@unknown.local`;
      const resolvedFullName =
        typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.length > 0
          ? user.user_metadata.full_name
          : resolvedEmail;

      const localUser = await this.authService.getOrCreateUserProfile(
        user.sub,
        resolvedEmail,
        resolvedFullName,
      );
      role = localUser.role;
    } catch (error) {
      this.logger.warn(
        `No se pudo sincronizar perfil local para usuario ${user.sub}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    return {
      sub: user.sub,
      email: user.email,
      role,
      user_metadata: user.user_metadata,
    };
  }
}
