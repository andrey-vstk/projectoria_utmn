import { IsString, MinLength } from 'class-validator';

export class UpdateProjectSourceTextDto {
  @IsString()
  @MinLength(20)
  sourceText!: string;
}
