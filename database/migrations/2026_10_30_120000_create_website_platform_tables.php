<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('website_contents', function (Blueprint $t) {
            $t->id();
            $t->string('kind');
            $t->string('slug')->unique();
            $t->json('draft');
            $t->json('published')->nullable();
            $t->timestamp('published_at')->nullable();
            $t->timestamps();
        });
        Schema::create('website_settings', function (Blueprint $t) {
            $t->id();
            $t->json('data');
            $t->timestamps();
        });
        DB::table('website_settings')->insert(['id' => 1, 'data' => json_encode(['hours' => [], 'blackouts' => [], 'timezone' => 'Africa/Johannesburg']), 'created_at' => now(), 'updated_at' => now()]);
        Schema::table('pricing_plans', function (Blueprint $t) {
            $t->string('public_vat_wording')->nullable();
            $t->string('public_approval_hash', 64)->nullable();
            $t->timestamp('public_approved_at')->nullable();
            $t->integer('public_order')->default(0);
        });
        Schema::create('demo_bookings', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->dateTime('starts_at')->index();
            $t->string('status')->default('confirmed');
            $t->string('name');
            $t->string('email');
            $t->string('company');
            $t->string('fleet_size');
            $t->string('phone')->nullable();
            $t->text('message')->nullable();
            $t->text('meeting_url')->nullable();
            $t->string('token_hash', 64);
            $t->dateTime('token_expires_at');
            $t->timestamp('reminded_at')->nullable();
            $t->timestamps();
        });
        Schema::create('support_tickets', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('created_by')->constrained('users');
            $t->foreignId('assigned_to')->nullable()->constrained('users');
            $t->string('subject');
            $t->string('category');
            $t->string('status')->default('open');
            $t->timestamps();
        });
        Schema::create('support_replies', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained();
            $t->text('body');
            $t->timestamps();
        });
        Schema::create('support_attachments', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('reply_id')->constrained('support_replies')->cascadeOnDelete();
            $t->string('path');
            $t->string('disk')->default('local');
            $t->string('name');
            $t->string('mime');
            $t->timestamps();
        });
        Schema::create('website_mail', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('recipient');
            $t->string('subject');
            $t->longText('body');
            $t->longText('calendar')->nullable();
            $t->string('status')->default('pending')->index();
            $t->unsignedInteger('attempts')->default(0);
            $t->timestamp('attempted_at')->nullable();
            $t->text('error')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['website_mail', 'support_attachments', 'support_replies', 'support_tickets', 'demo_bookings', 'website_settings', 'website_contents'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('pricing_plans', fn (Blueprint $t) => $t->dropColumn(['public_vat_wording', 'public_approval_hash', 'public_approved_at', 'public_order']));
    }
};
