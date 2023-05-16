import { v4 as uuidv4 } from 'uuid';

export function WebsocketHelper() {
    return function (constructor: any) {
        const originalOnInit = constructor.prototype.ngOnInit;
        const originalOnDestroy = constructor.prototype.ngOnDestroy;

        constructor.prototype.ngOnInit = function () {
            this.id = uuidv4();

            if (this.websocketService?.Unsubscribe &&
                typeof this.websocketService.Subscribe === 'function')
                this.server = this.websocketService.Subscribe(this.id);

            if (originalOnInit && typeof originalOnInit === 'function') {
                originalOnInit.apply(this, arguments);
            }
        };

        constructor.prototype.ngOnDestroy = function () {

            if (this.websocketService?.Unsubscribe &&
                typeof this.websocketService.Unsubscribe === 'function')
                this.websocketService.Unsubscribe(this.id);

            if (originalOnDestroy && typeof originalOnDestroy === 'function') {
                originalOnDestroy.apply(this, arguments);
            }
        };
    };
}