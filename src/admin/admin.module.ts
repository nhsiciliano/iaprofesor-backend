
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { TutorModule } from '../tutor/tutor.module';
import { PassportModule } from '@nestjs/passport';

@Module({
    imports: [
        TutorModule,
        PassportModule.register({ defaultStrategy: 'jwt' })
    ],
    controllers: [AdminController],
})
export class AdminModule { }
