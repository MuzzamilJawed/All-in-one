import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import Watchlist from '../../../../models/Watchlist';
import { requireAdmin, fail } from '../../../../lib/apiAuth';
import { userStats } from '../../../../lib/userStats';

const notFound = () =>
    NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

// Full detail for one account: profile fields, activity counts and a summary of
// the watchlists they keep (names and sizes only — not an admin back door into
// another user's holdings).
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { session, response } = await requireAdmin();
    if (!session) return response;
    const { id } = await params;
    try {
        await dbConnect();
        const user = await User.findById(id)
            .select('name email phone image role providers createdAt lastLoginAt universalWatch')
            .lean() as any;
        if (!user) return notFound();

        const [stats, lists] = await Promise.all([
            userStats(id),
            Watchlist.find({ userId: id }).select('name type symbols createdAt').sort({ createdAt: -1 }).lean(),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                id: String(user._id),
                name: user.name,
                email: user.email,
                phone: user.phone || null,
                image: user.image || null,
                role: user.role,
                providers: user.providers || [],
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt || null,
                watching: (user.universalWatch || []).length,
                stats,
                watchlists: (lists as any[]).map(l => ({
                    id: String(l._id),
                    name: l.name,
                    type: l.type,
                    symbols: (l.symbols || []).length,
                    createdAt: l.createdAt,
                })),
            },
        });
    } catch (error) {
        console.error('[admin/users] GET by id failed:', error);
        return fail(error, 'Failed to load this user');
    }
}

// Role changes only. Guarded so an admin can't lock everyone out by demoting
// themselves or the last remaining administrator.
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { session, response } = await requireAdmin();
    if (!session) return response;
    const { id } = await params;
    try {
        await dbConnect();
        const body = await request.json();
        const role = body?.role;
        if (role !== 'admin' && role !== 'user') {
            return NextResponse.json({ success: false, error: 'Role must be admin or user' }, { status: 400 });
        }

        const target = await User.findById(id);
        if (!target) return notFound();

        if (target.role === 'admin' && role === 'user') {
            if (String(target._id) === session.uid) {
                return NextResponse.json(
                    { success: false, error: "You can't remove your own administrator access" },
                    { status: 400 },
                );
            }
            const admins = await User.countDocuments({ role: 'admin' });
            if (admins <= 1) {
                return NextResponse.json(
                    { success: false, error: 'At least one administrator must remain' },
                    { status: 400 },
                );
            }
        }

        target.role = role;
        await target.save();

        return NextResponse.json({ success: true, data: { id: String(target._id), role: target.role } });
    } catch (error) {
        console.error('[admin/users] PATCH failed:', error);
        return fail(error, 'Failed to update this user');
    }
}
