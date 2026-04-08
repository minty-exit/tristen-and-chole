import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default function handler() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f0eb',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            border: '2px solid #c9a96e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <span style={{ fontSize: 48, color: '#c9a96e', fontStyle: 'italic' }}>
            T & C
          </span>
        </div>
        <div
          style={{
            fontSize: 52,
            color: '#1a1512',
            fontStyle: 'italic',
            marginBottom: 8,
          }}
        >
          Tristen & Chloe
        </div>
        <div
          style={{
            fontSize: 18,
            color: '#5c4f3d',
            letterSpacing: 6,
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          You're Invited
        </div>
        <div
          style={{
            width: 60,
            height: 1,
            backgroundColor: '#c9a96e',
            marginBottom: 16,
          }}
        />
        <div
          style={{
            fontSize: 20,
            color: '#7a6d5c',
            letterSpacing: 4,
          }}
        >
          June 13, 2026
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
