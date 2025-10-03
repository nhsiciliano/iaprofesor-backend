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
    console.log('JWT Strategy - Custom validation started');
    
    // Extraer el token raw del header Authorization
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    console.log('JWT Strategy - Validating token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
    
    if (!token) {
      console.error('JWT Strategy - No token found in request');
      return done(new UnauthorizedException('Token no encontrado'), false);
    }

    try {
      // Validar token con Supabase
      const user = await this.authService.validateToken(token);
      
      if (!user) {
        console.error('JWT Strategy - Token validation returned null');
        return done(new UnauthorizedException('Token inválido o expirado'), false);
      }

      console.log('JWT Strategy - Token validated for user:', user.email);

      // Crear/actualizar perfil local si es necesario
      try {
        await this.authService.getOrCreateUserProfile(
          user.sub,
          user.email,
          user.user_metadata?.full_name || user.email
        );
      } catch (error) {
        console.warn('No se pudo sincronizar perfil local:', error.message);
      }

      const result = {
        sub: user.sub,
        email: user.email,
        user_metadata: user.user_metadata,
        ...user,
      };
      
      console.log('JWT Strategy - Validation successful');
      return done(null, result);
    } catch (error) {
      console.error('JWT Strategy - Validation error:', error.message);
      return done(new UnauthorizedException('Error al validar token: ' + error.message), false);
    }
  }
}
