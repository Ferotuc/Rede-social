import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, IsOptional } from 'class-validator';
export class RegisterDto {
  @ApiProperty() @IsString() @Length(2, 80) @Matches(/\S/) name!: string;
  @ApiProperty() @IsString() @Matches(/^[a-zA-Z0-9_]{3,24}$/) username!: string;
  @ApiProperty() @IsEmail() @Length(3, 254) email!: string;
  @ApiProperty({ minLength: 10, maxLength: 128 }) @IsString() @Length(10, 128) password!: string;
}
export class LoginDto {
  @ApiProperty() @IsEmail() @Length(3, 254) email!: string;
  @ApiProperty() @IsString() @Length(1, 128) password!: string;
}
export class PostDto {
  @ApiProperty({ maxLength: 1000 }) @IsString() @Length(1, 1000) @Matches(/\S/) content!: string;
}
export class CommentDto {
  @ApiProperty({ maxLength: 500 }) @IsString() @Length(1, 500) @Matches(/\S/) content!: string;
}
export class ProfileDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @Length(2, 80) name?: string;
  @ApiProperty({ required: false, maxLength: 160 })
  @IsOptional()
  @IsString()
  @Length(0, 160)
  bio?: string;
}
