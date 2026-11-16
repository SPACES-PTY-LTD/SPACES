<?php

namespace Database\Seeders;

use App\Models\Website\Content;
use Illuminate\Database\Seeder;

class WebsiteContentSeeder extends Seeder
{
    public function run(): void
    {
        foreach (json_decode(file_get_contents(__DIR__.'/data/website-content.json'), true, 512, JSON_THROW_ON_ERROR) as $row) {
            Content::firstOrCreate(['slug' => $row['slug']], ['kind' => $row['kind'], 'draft' => $row['draft'],
                'published' => $row['publish'] ? $row['draft'] : null, 'published_at' => $row['publish'] ? now() : null]);
        }
    }
}
