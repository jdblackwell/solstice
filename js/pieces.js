// Original Staunton silhouettes. Shared viewBox, every base on y = 100.

const BODY = {
  p: 'M50 18C60.2 18 68 25.6 68 35.6C68 45.6 60.2 53.2 50 53.2C39.8 53.2 32 45.6 32 35.6C32 25.6 39.8 18 50 18Z M44 50.5C40.2 55 38.4 60 39.2 66.5L34.2 81C31.4 87.2 28 91.4 23.2 94.2C20.4 96 22.2 100 28.4 100H71.6C77.8 100 79.6 96 76.8 94.2C72 91.4 68.6 87.2 65.8 81L60.8 66.5C61.6 60 59.8 55 56 50.5C53.6 52.6 46.4 52.6 44 50.5Z',
  r: 'M22 100H78V91H70V80H66V68L76 60V38H70V18H58V38H52V18H40V38H34V18H22V38V60L34 68V80H30V91H22Z',
  b: 'M50 5L66 40C68 48 58 54 54 56L60 66C64 74 58 84 54 90L62 95L70 99H30L38 95L46 90C42 84 36 74 40 66L46 56C42 54 32 48 34 40Z M50 15L52.2 32L50 44L47.8 32Z',
  n: 'M30 100H70V93H62V86C72 80 80 74 70 68C60 64 80 58 68 52C58 48 74 42 62 36L70 18L56 8L48 24L40 18L14 30L6 40L6 50L16 54L8 64L30 72L38 84L30 93Z',
  q: 'M14 62L22 40L32 54L40 30L48 52L50 12L52 52L60 30L68 54L78 40L86 62C90 74 82 84 74 90L80 95C84 98 76 100 50 100C24 100 16 98 20 95L26 90C18 84 10 74 14 62Z',
  k: 'M43 3H57V15H71V29H57V39C72 43 80 54 77 67C81 76 76 86 67 91L73 95C77 98 73 100 50 100C27 100 23 98 27 95L33 91C24 86 19 76 23 67C20 54 28 43 43 39V29H29V15H43Z',
};

function ink(color) {
  return color === 'w' ? 'rgba(62,36,22,.55)' : 'rgba(255,236,214,.72)';
}

function extras(color, type) {
  if (type === 'n') {
    return `<circle cx="28" cy="40" r="2.2" fill="${ink(color)}" stroke="none"/>`;
  }
  return '';
}

export function pieceMarkup(color, type) {
  const fill = color === 'w' ? 'url(#metal-w)' : 'url(#metal-b)';
  const edge = color === 'w' ? 'var(--pw-edge)' : 'var(--pb-edge)';
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <path d="${BODY[type]}" fill="${fill}" stroke="${edge}" stroke-width="1.7" stroke-linejoin="round" fill-rule="evenodd"/>
    ${extras(color, type)}
  </svg>`;
}
