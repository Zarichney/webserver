// auto-unsubscribe.decorator.ts
export function AutoUnsubscribe(subscriptionPropertyKey: string) {
    return function (constructor: any) {
      const originalOnDestroy = constructor.prototype.ngOnDestroy;
  
      constructor.prototype.ngOnDestroy = function () {
        const subscription = this[subscriptionPropertyKey];
  
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
  
        if (originalOnDestroy && typeof originalOnDestroy === 'function') {
          originalOnDestroy.apply(this, arguments);
        }
      };
    };
  }
  