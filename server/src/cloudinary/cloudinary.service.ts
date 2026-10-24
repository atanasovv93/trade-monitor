
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>(
        'CLOUDINARY_CLOUD_NAME',
      ),
      api_key: this.configService.get<string>(
        'CLOUDINARY_API_KEY',
      ),
      api_secret: this.configService.get<string>(
        'CLOUDINARY_API_SECRET',
      ),
      secure: true,
    });
  }

  
async getImages() {
  const result = await cloudinary.api.resources({
    type: 'upload',
    resource_type: 'image',
    max_results: 50,
  });

  return result.resources.map((image) => ({
    publicId: image.public_id,
    url: image.secure_url,
    format: image.format,
    width: image.width,
    height: image.height,
    createdAt: image.created_at,
  }));
}

async getImage(publicId: string) {
  const image = await cloudinary.api.resource(publicId, {
    resource_type: 'image',
  });

  return {
    publicId: image.public_id,
    url: image.secure_url,
    format: image.format,
    width: image.width,
    height: image.height,
    size: image.bytes,
    createdAt: image.created_at,
  };
}


  async uploadImage(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse> {
    try {
      return await new Promise<UploadApiResponse>(
        (resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'trade-monitor',
              resource_type: 'image',
            },
            (error, result) => {
              if (error) {
                reject(error);
                return;
              }

              if (!result) {
                reject(new Error('Upload failed'));
                return;
              }

              resolve(result);
            },
          );

          stream.end(file.buffer);
        },
      );
    } catch {
      throw new InternalServerErrorException(
        'Failed to upload image to Cloudinary',
      );
    }
  }

  
async deleteImage(publicId: string) {
  try {
    const result = await cloudinary.uploader.destroy(
      publicId,
      {
        resource_type: 'image',
        type: 'upload',
        invalidate: true,
      },
    );

    if (result.result !== 'ok') {
      if (result.result === 'not found') {
        throw new NotFoundException(
          'Image not found in Cloudinary',
        );
      }

      throw new InternalServerErrorException(
        'Failed to delete image from Cloudinary',
      );
    }

    return {
      message: 'Image deleted successfully',
      publicId,
    };
  } catch (error) {
    if (
      error instanceof NotFoundException ||
      error instanceof InternalServerErrorException
    ) {
      throw error;
    }

    throw new InternalServerErrorException(
      'Failed to delete image from Cloudinary',
    );
  }
}

}
