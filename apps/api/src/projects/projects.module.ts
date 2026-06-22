import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { MailingsModule } from '../mailings/mailings.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AnalysisModule, MailingsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
