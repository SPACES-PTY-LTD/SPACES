<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Keep the most recently registered active device for duplicate legacy tokens.
        DB::table('user_devices')->whereNotNull('deleted_at')->update(['push_token' => null]);
        DB::table('user_devices')->where('push_token', '')->update(['push_token' => null]);
        $duplicates = DB::table('user_devices')->select('push_token')->whereNotNull('push_token')
            ->groupBy('push_token')->havingRaw('COUNT(*) > 1')->pluck('push_token');
        foreach ($duplicates as $token) {
            $keep = DB::table('user_devices')->where('push_token', $token)->orderByDesc('updated_at')->orderByDesc('id')->value('id');
            DB::table('user_devices')->where('push_token', $token)->where('id', '!=', $keep)->update(['push_token' => null]);
        }
        Schema::table('user_devices', fn (Blueprint $table) => $table->unique('push_token', 'user_devices_push_token_unique'));
    }

    public function down(): void
    {
        Schema::table('user_devices', fn (Blueprint $table) => $table->dropUnique('user_devices_push_token_unique'));
    }
};
