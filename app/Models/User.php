<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes, HasUuid, HasAccountId;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'account_id',
        'last_accessed_merchant_id',
        'name',
        'email',
        'password',
        'telephone',
        'role',
        'last_login_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function merchants()
    {
        return $this->belongsToMany(Merchant::class)
            ->withPivot(['role'])
            ->withTimestamps();
    }

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function ownedAccount()
    {
        return $this->hasOne(Account::class, 'owner_user_id');
    }

    public function ownedMerchants()
    {
        return $this->hasMany(Merchant::class, 'owner_user_id');
    }

    public function lastAccessedMerchant()
    {
        return $this->belongsTo(Merchant::class, 'last_accessed_merchant_id');
    }

    public function driver()
    {
        return $this->hasOne(Driver::class);
    }

    public function refreshTokens()
    {
        return $this->hasMany(RefreshToken::class);
    }

    public function devices()
    {
        return $this->hasMany(UserDevice::class);
    }
}
