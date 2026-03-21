import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePublicResponseDto {
  @IsOptional()
  @IsEmail()
  responderEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  responderName?: string;
}
