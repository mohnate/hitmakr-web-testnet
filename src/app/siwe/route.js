import { tap } from "@/lib/siwe/utils";
import Session from "@/lib/siwe/session";
import { NextResponse } from 'next/server';
import { SiweErrorType, SiweMessage, generateNonce } from 'siwe';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;


export const GET = async (req) => {
    const session = await Session.fromRequest(req);
    return NextResponse.json(session.toJSON());
};



export const PUT = async (req) => {
    const session = await Session.fromRequest(req);
    if (!session?.nonce) session.nonce = generateNonce();

    return tap(new NextResponse(session.nonce), (res) => session.persist(res));
};



export const POST = async (req) => {
    const { message, signature } = await req.json();
    const session = await Session.fromRequest(req);

    try {
        const siweMessage = new SiweMessage(message);
        const { data: fields } = await siweMessage.verify({
            signature,
            nonce: session.nonce,
        });

        if (fields.nonce !== session.nonce) {
            return tap(new NextResponse('Invalid nonce.', { status: 422 }), (res) => session.clear(res));
        }

        session.address = fields.address;
        session.chainId = fields.chainId;

        const token = jwt.sign(
            { address: fields.address, chainId: fields.chainId },
            JWT_SECRET,
            { expiresIn: '20d' }
        );

        return tap(NextResponse.json({ token, ok: true }), (res) => session.persist(res));

    } catch (error) {
        switch (error) {
            case SiweErrorType.INVALID_NONCE:
            case SiweErrorType.INVALID_SIGNATURE:
                return tap(new NextResponse(String(error), { status: 422 }), (res) => session.clear(res));
            default:
                return tap(new NextResponse(String(error), { status: 400 }), (res) => session.clear(res));
        }
    }
};



export const DELETE = async (req) => {
    const session = await Session.fromRequest(req);

    return tap(new NextResponse(''), (res) => session.clear(res));
};
