<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE merchant_user MODIFY role ENUM('owner','admin','developer','billing','read_only','account_holder','member','modifier','biller','resource_viewer') NOT NULL");
            DB::statement("ALTER TABLE merchant_invites MODIFY role ENUM('admin','developer','billing','read_only','member','modifier','biller','resource_viewer') NOT NULL");
        }

        DB::table('merchant_user')->whereIn('role', ['owner', 'admin'])->update(['role' => 'member']);
        DB::table('merchant_user')->where('role', 'developer')->update(['role' => 'modifier']);
        DB::table('merchant_user')->where('role', 'billing')->update(['role' => 'biller']);
        DB::table('merchant_user')->where('role', 'read_only')->update(['role' => 'resource_viewer']);

        DB::table('merchant_invites')->whereIn('role', ['owner', 'admin'])->update(['role' => 'member']);
        DB::table('merchant_invites')->where('role', 'developer')->update(['role' => 'modifier']);
        DB::table('merchant_invites')->where('role', 'billing')->update(['role' => 'biller']);
        DB::table('merchant_invites')->where('role', 'read_only')->update(['role' => 'resource_viewer']);

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE merchant_user MODIFY role ENUM('account_holder','member','modifier','biller','resource_viewer') NOT NULL");
            DB::statement("ALTER TABLE merchant_invites MODIFY role ENUM('member','modifier','biller','resource_viewer') NOT NULL");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE merchant_user MODIFY role ENUM('owner','admin','developer','billing','read_only','account_holder','member','modifier','biller','resource_viewer') NOT NULL");
            DB::statement("ALTER TABLE merchant_invites MODIFY role ENUM('admin','developer','billing','read_only','member','modifier','biller','resource_viewer') NOT NULL");
        }

        DB::table('merchant_user')->where('role', 'member')->update(['role' => 'admin']);
        DB::table('merchant_user')->where('role', 'modifier')->update(['role' => 'developer']);
        DB::table('merchant_user')->where('role', 'biller')->update(['role' => 'billing']);
        DB::table('merchant_user')->where('role', 'resource_viewer')->update(['role' => 'read_only']);

        DB::table('merchant_invites')->where('role', 'member')->update(['role' => 'admin']);
        DB::table('merchant_invites')->where('role', 'modifier')->update(['role' => 'developer']);
        DB::table('merchant_invites')->where('role', 'biller')->update(['role' => 'billing']);
        DB::table('merchant_invites')->where('role', 'resource_viewer')->update(['role' => 'read_only']);

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE merchant_user MODIFY role ENUM('owner','admin','developer','billing','read_only') NOT NULL");
            DB::statement("ALTER TABLE merchant_invites MODIFY role ENUM('admin','developer','billing','read_only') NOT NULL");
        }
    }
};
