import { IsString } from 'class-validator';

export class UpsertSettingDto {
  @IsString()
  key!: string;

  @IsString()
  value!: string;
}
