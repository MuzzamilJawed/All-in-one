import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';
import { requireAdmin, fail } from '../../../lib/apiAuth';
import { statsForAllUsers } from '../../../lib/userStats';

// Admin directory of every registered account, with each user's activity
// counts folded in.
export async function GET() {
    const { session, response } = await requireAdmin();
    if (!session) return response;
    try {
        await dbConnect();
        const users = await User.find({})
            .select('name email phone image role providers createdAt lastLoginAt universalWatch')
            .sort({ createdAt: -1 })
            .lean();

        const ids = users.map((u: any) => String(u._id));
        const stats = await statsForAllUsers(ids);

        const data = users.map((u: any) => ({
            id: String(u._id),
            name: u.name,
            email: u.email,
            phone: u.phone || null,
            image: u.image || null,
            role: u.role,
            providers: u.providers || [],
            createdAt: u.createdAt,
            lastLoginAt: u.lastLoginAt || null,
            watching: (u.universalWatch || []).length,
            ...stats[String(u._id)],
        }));

        return NextResponse.json({
            success: true,
            data,
            summary: {
                total: data.length,
                admins: data.filter(u => u.role === 'admin').length,
                withGoogle: data.filter(u => u.providers.includes('google')).length,
            },
        });
    } catch (error) {
        console.error('[admin/users] GET failed:', error);
        return fail(error, 'Failed to load users');
    }
}
