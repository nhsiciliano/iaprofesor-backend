
import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TutorService } from '../tutor/tutor.service';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class AdminController {
    constructor(private readonly tutorService: TutorService) { }

    @Get('subjects')
    @ApiOperation({ summary: 'Get all subjects including system prompts (Admin)' })
    @ApiResponse({ status: 200, description: 'Return all subjects.' })
    async getAllSubjects() {
        // We already have getAvailableSubjects in TutorService, but we might want raw access
        // For now, re-using getAvailableSubjects but noting that it might filter inactive ones
        // We actually want ALL subjects for admin, even inactive ones.
        // So we should add a method in TutorService to get all subjects or just fetch via Prisma here?
        // Let's modify TutorService to have a getAllSubjects method or use Prisma directly if we injected it.
        // Ideally we use service.

        // For MVP, let's use getAvailableSubjects but eventually we need a "getAll" including inactive.
        // Wait, getAvailableSubjects reads from memory map which only has active ones?
        // Let's check TutorService loadSubjects:
        // "where: { isActive: true }" -> YES, memory only has active.

        // We need a new method in TutorService: getAllSubjectsForAdmin()
        return this.tutorService.getAllSubjectsForAdmin();
    }

    @Patch('subjects/:id')
    @ApiOperation({ summary: 'Update a subject' })
    async updateSubject(@Param('id') id: string, @Body() updateSubjectDto: UpdateSubjectDto) {
        return this.tutorService.updateSubject(id, updateSubjectDto);
    }
}
