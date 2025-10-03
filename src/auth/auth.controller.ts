import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';

/**
 * CONTROLADOR DE AUTENTICACIÓN - ARQUITECTURA FRONTEND-FIRST
 * 
 * Este controlador maneja:
 * - Validación de tokens JWT
 * - Información de usuario autenticado
 * - Endpoints legacy (deprecados)
 * 
 * La autenticación principal se maneja en el frontend con Supabase
 */

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('user')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Obtener usuario autenticado',
    description: 'Retorna información del usuario basada en el JWT token de Supabase'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Información del usuario autenticado',
    schema: {
      type: 'object',
      properties: {
        sub: { type: 'string', description: 'ID del usuario' },
        email: { type: 'string', description: 'Email del usuario' },
        user_metadata: { type: 'object', description: 'Metadatos adicionales' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Token inválido o faltante.' })
  async getCurrentUser(@Req() req) {
    // El usuario ya está validado por la estrategia JWT
    const userId = req.user.sub;
    
    // Obtener información adicional de la base de datos local
    const userProfile = await this.authService.getCurrentUser(userId);
    
    return {
      ...req.user,
      profile: userProfile,
    };
  }

  @Get('validate')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Validar token JWT',
    description: 'Endpoint para validar que el token JWT es válido'
  })
  @ApiResponse({ status: 200, description: 'Token válido' })
  @ApiResponse({ status: 401, description: 'Token inválido' })
  async validateToken(@Req() req) {
    return {
      valid: true,
      user: {
        id: req.user.sub,
        email: req.user.email,
      },
    };
  }

  // =============================================================================
  // ENDPOINTS LEGACY - DEPRECADOS
  // Mantener para compatibilidad pero guiar hacia la nueva arquitectura
  // =============================================================================

  @Post('signup')
  @ApiOperation({ 
    summary: '[DEPRECADO] Registro de usuario',
    description: 'DEPRECADO: Use Supabase auth directamente desde el frontend. Este endpoint se mantendrá temporalmente para compatibilidad.',
    deprecated: true,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'test@example.com' },
        password: { type: 'string', example: 'password123' },
        fullName: { type: 'string', example: 'John Doe' },
      },
      required: ['email', 'password', 'fullName'],
    },
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Usuario creado (DEPRECADO: Use frontend Supabase auth)',
    headers: {
      'X-Deprecated': {
        description: 'Este endpoint está deprecado',
        schema: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  async signup(@Body() { email, password, fullName }) {
    console.warn('⚠️  USANDO ENDPOINT DEPRECADO: /auth/signup');
    console.warn('   ➡️  Migre a autenticación frontend con Supabase');
    
    const result = await this.authService.signUp(email, password, fullName);
    
    return {
      ...result,
      _deprecated: true,
      _message: 'Este endpoint está deprecado. Use Supabase auth desde el frontend.',
    };
  }

  @Post('login')
  @ApiOperation({ 
    summary: '[DEPRECADO] Inicio de sesión',
    description: 'DEPRECADO: Use Supabase auth directamente desde el frontend. Este endpoint se mantendrá temporalmente para compatibilidad.',
    deprecated: true,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'test@example.com' },
        password: { type: 'string', example: 'password123' },
      },
      required: ['email', 'password'],
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Sesión iniciada (DEPRECADO: Use frontend Supabase auth)',
    headers: {
      'X-Deprecated': {
        description: 'Este endpoint está deprecado',
        schema: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Credenciales incorrectas.' })
  async login(@Body() { email, password }) {
    console.warn('⚠️  USANDO ENDPOINT DEPRECADO: /auth/login');
    console.warn('   ➡️  Migre a autenticación frontend con Supabase');
    
    const result = await this.authService.login(email, password);
    
    return {
      ...result,
      _deprecated: true,
      _message: 'Este endpoint está deprecado. Use Supabase auth desde el frontend.',
    };
  }
}
