import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(20)
  sourceText!: string;
}
