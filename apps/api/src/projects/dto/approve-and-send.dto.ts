import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SuggestionPatchDto } from './update-suggestions.dto';

export class ApproveAndSendDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuggestionPatchDto)
  suggestions?: SuggestionPatchDto[];
}
