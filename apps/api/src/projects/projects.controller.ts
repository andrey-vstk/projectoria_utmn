import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { ApproveAndSendDto } from './dto/approve-and-send.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateSuggestionsDto } from './dto/update-suggestions.dto';
import { ProjectsService } from './projects.service';

interface UploadedTextFile {
  originalname: string;
  buffer: Buffer;
}

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.projectsService.list(user);
  }

  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: JwtPayload) {
    return this.projectsService.create(dto, user);
  }

  @Post('extract-text')
  @UseInterceptors(FileInterceptor('file'))
  extractText(@UploadedFile() file: UploadedTextFile | undefined) {
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    const filename = file.originalname.toLowerCase();
    if (!filename.endsWith('.txt')) {
      throw new BadRequestException(
        'В MVP поддерживается извлечение только из .txt файлов',
      );
    }

    return {
      text: file.buffer.toString('utf-8'),
      fileName: file.originalname,
    };
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.projectsService.getById(id, user);
  }

  @Post(':id/analyze')
  queueAnalysis(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.projectsService.queueAnalysis(id, user);
  }

  @Patch(':id/suggestions')
  updateSuggestions(
    @Param('id') id: string,
    @Body() dto: UpdateSuggestionsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectsService.updateSuggestions(id, dto, user);
  }

  @Post(':id/approve-and-send')
  approveAndSend(
    @Param('id') id: string,
    @Body() dto: ApproveAndSendDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectsService.approveAndSend(id, dto, user);
  }

  @Get(':id/responses')
  responses(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.projectsService.listResponses(id, user);
  }
}
