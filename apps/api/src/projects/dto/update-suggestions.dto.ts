import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SuggestionPatchDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsBoolean()
  includeInMailing?: boolean;

  @IsOptional()
  @IsString()
  customSubject?: string;

  @IsOptional()
  @IsString()
  customBody?: string;
}

export class UpdateSuggestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SuggestionPatchDto)
  suggestions!: SuggestionPatchDto[];
}
