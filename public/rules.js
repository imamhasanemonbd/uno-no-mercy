export const drawValue=card=>card?.value==='reverse+4'?4:Number(/^\+(2|4|6|10)$/.exec(card?.value)?.[1]||0);
export function playableCard(state,card){
 if(state.pending)return false;
 if(state.drawn&&card.id!==state.drawn)return false;
 if(state.penalty)return drawValue(card)>0&&drawValue(card)>=drawValue(state.top);
 return card.color==='wild'||card.color===state.color||card.value===state.top?.value;
}
export const cardNames={skip:'Skip',reverse:'Reverse',discard:'Discard All','skip-all':'Skip Everyone','reverse+4':'Reverse +4',roulette:'Color Roulette'};
