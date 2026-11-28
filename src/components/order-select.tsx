/** "Nov 27, 7:42 PM": the name an order or store trip gets when none is typed. */
export const defaultOrderName = () => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date());
