import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { LlmService } from '../llm/llm.service';
import { DemoAnalyzeDto } from './dto/demo-analyze.dto';

@Public()
@Controller('demo')
export class DemoController {
  constructor(private readonly llmService: LlmService) {}

  @Post('analyze')
  analyze(@Body() dto: DemoAnalyzeDto) {
    return this.llmService.analyze({
      projectId: `demo-${Date.now()}`,
      projectTitle: dto.projectTitle,
      sourceText: dto.sourceText,
      departments: dto.departments,
    });
  }
}
