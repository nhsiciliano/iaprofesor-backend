import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private authService: AuthService,
  ) {
    super();
  }

  async validate(req: any, done: Function) {
    // Extraer el token raw del header Authorization
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return done(new UnauthorizedException('Token no encontrado'), false);
    }

    try {
      // Validar token con Supabase
      const user = await this.authService.validateToken(token);
      
      if (!user) {
        return done(new UnauthorizedException('Token inválido o expirado'), false);
      }

      // Crear/actualizar perfil local si es necesario
      let role = 'user';
      try {
        const localUser = await this.authService.getOrCreateUserProfile(
          user.sub,
          user.email,
          user.user_metadata?.full_name || user.email
        );
        role = localUser.role;
      } catch (error) {
        console.warn('No se pudo sincronizar perfil local:', error.message);
      }

      const result = {
        sub: user.sub,
        email: user.email,
        role: role,
        user_metadata: user.user_metadata,
        ...user,
      };
      
      return done(null, result);
    } catch (error) {
      return done(new UnauthorizedException('Error al validar token: ' + error.message), false);
    }
  }
}
