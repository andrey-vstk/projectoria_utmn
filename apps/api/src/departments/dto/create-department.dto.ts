import {
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DepartmentRecipientDto } from './department-recipient.dto';

export class CreateDepartmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(12)
  @Matches(/^[\wА-Яа-я-]+$/u)
  code?: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentRecipientDto)
  recipients!: DepartmentRecipientDto[];
}
