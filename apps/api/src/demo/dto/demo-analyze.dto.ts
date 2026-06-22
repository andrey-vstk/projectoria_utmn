import { Type } from 'class-transformer';
import { IsArray, IsString, MinLength, ValidateNested } from 'class-validator';

export class DemoDepartmentDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @IsString({ each: true })
  competencies!: string[];

  @IsArray()
  @IsString({ each: true })
  employeeCompetencies!: string[];
}

export class DemoAnalyzeDto {
  @IsString()
  @MinLength(2)
  projectTitle!: string;

  @IsString()
  @MinLength(20)
  sourceText!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DemoDepartmentDto)
  departments!: DemoDepartmentDto[];
}
