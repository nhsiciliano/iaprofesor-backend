import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('notes')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notes')
export class NotesController {
    constructor(private readonly notesService: NotesService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new note' })
    create(@Req() req, @Body() createNoteDto: CreateNoteDto) {
        return this.notesService.create(req.user.sub, createNoteDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all user notes' })
    findAll(@Req() req, @Query('subjectId') subjectId?: string) {
        return this.notesService.findAll(req.user.sub, subjectId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific note' })
    findOne(@Req() req, @Param('id') id: string) {
        return this.notesService.findOne(req.user.sub, id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a note' })
    remove(@Req() req, @Param('id') id: string) {
        return this.notesService.remove(req.user.sub, id);
    }
}
