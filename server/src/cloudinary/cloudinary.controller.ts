
import {
    BadRequestException,
    Controller,
    Post,
    Get,
    Param,
    UploadedFile,
    UseInterceptors,
    Delete,
    Query
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CloudinaryService } from './cloudinary.service';

@Controller('uploads')
export class CloudinaryController {
    constructor(
        private readonly cloudinaryService: CloudinaryService,
    ) { }

    @Get('images')
    async getImages() {
        return this.cloudinaryService.getImages();
    }

    @Get('image/:publicId')
    async getImage(@Param('publicId') publicId: string) {
        return this.cloudinaryService.getImage(publicId);
    }

    @Post('image')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            limits: {
                fileSize: 5 * 1024 * 1024,
            },
            fileFilter: (_req, file, callback) => {
                const allowedTypes = [
                    'image/jpeg',
                    'image/png',
                    'image/webp',
                    'image/gif',
                ];

                if (!allowedTypes.includes(file.mimetype)) {
                    return callback(
                        new BadRequestException(
                            'Only JPEG, PNG, WEBP and GIF images are allowed',
                        ),
                        false,
                    );
                }

                callback(null, true);
            },
        }),
    )
    async uploadImage(
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException(
                'Please provide an image file',
            );
        }

        const result =
            await this.cloudinaryService.uploadImage(file);

        return {
            message: 'Image uploaded successfully',
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            size: result.bytes,
        };
    }

    @Delete('image')
    async deleteImage(@Query('publicId') publicId: string) {
        if (!publicId) {
            throw new BadRequestException(
                'publicId query parameter is required',
            );
        }

        return this.cloudinaryService.deleteImage(publicId);
    }
}
