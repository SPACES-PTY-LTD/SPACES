<?php

use App\Http\Controllers\Api\V1\Website\SupportController as S;
use App\Http\Controllers\Api\V1\Website\WebsiteController as W;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/website')->group(function () {
    Route::get('content', [W::class, 'contents']);
    Route::get('pricing', [W::class, 'prices']);
    Route::get('contact', [W::class, 'contact']);
    Route::get('demo/slots', [W::class, 'slots'])->middleware('throttle:60,1');
    Route::post('demo/book', [W::class, 'book'])->middleware('throttle:5,60');
    Route::post('demo/manage', [W::class, 'manageBooking'])->middleware('throttle:10,1');
    Route::middleware(['auth.api', 'role:super_admin'])->prefix('admin')->group(function () {
        Route::get('/', [W::class, 'adminIndex']);
        Route::post('content', [W::class, 'saveContent']);
        Route::post('content/{content}/publication', [W::class, 'publication']);
        Route::patch('settings', [W::class, 'settings']);
        Route::patch('pricing/{plan}', [W::class, 'approvePrice']);
        Route::get('bookings', [W::class, 'bookings']);
        Route::patch('bookings/{booking}', [W::class, 'updateBooking']);
        Route::post('mail/{mail}/retry', [W::class, 'retryMail']);
    });
});
Route::middleware(['auth.api', 'role:user,super_admin'])->prefix('v1/support')->group(function () {
    Route::get('tickets', [S::class, 'index']);
    Route::post('tickets', [S::class, 'store'])->middleware('throttle:10,1');
    Route::get('tickets/{ticket}', [S::class, 'show']);
    Route::patch('tickets/{ticket}', [S::class, 'update']);
    Route::post('tickets/{ticket}/replies', [S::class, 'reply'])->middleware('throttle:20,1');
    Route::get('attachments/{attachment}', [S::class, 'download']);
});
