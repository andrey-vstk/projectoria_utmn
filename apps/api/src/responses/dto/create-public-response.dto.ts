import { ResponseDecision } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePublicResponseDto {
  @IsEnum(ResponseDecision)
  decision!: ResponseDecision;

  @IsOptional()
  @IsEmail()
  responderEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  responderName?: string;
}
