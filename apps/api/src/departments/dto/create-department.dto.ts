import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @MaxLength(12)
  @Matches(/^[\wА-Яа-я-]+$/u)
  code!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsEmail({}, { each: true })
  recipients!: string[];
}
