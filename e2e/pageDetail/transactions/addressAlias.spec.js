import config from '../../config/network.conf.json';
import datafiled from '../../config/datafiled.json';

describe('Symbol Explorer Transaction detail page for Address Alias', () => {
    beforeEach(() => {
        cy.visit(`/transactions/${config.testTransactions.addressAlias}`);
    });

    describe('Transaction info card should', () => {
        it('load title', () => {
            cy.get('[data-cy="transactionInfoTitle"]').should(
                'contain',
                'Transaction Info',
            );
        });

        it('render data info in table', () => {
            cy.renderTableInCard('transactionInfoTitle');
        });

        it('render correct transaction info titles', () => {
            const items = datafiled.transactionInfoFields;
            cy.renderFieldInTable('transactionInfoTitle', items);
        });
    });

    describe('Transaction Detail card should', () => {
        it('load title', () => {
            cy.get('[data-cy="transactionDetailTitle"]').should(
                'contain',
                'Transaction Detail',
            );
        });

        it('render data info in table', () => {
            cy.renderTableInCard('transactionDetailTitle');
        });

        it('render correct transaction detail titles', () => {
            const items = [
                'Transaction Type',
                'Alias Action',
                'Namespace ID',
                'Name',
                'Address',
            ];
            cy.renderFieldInTable('transactionDetailTitle', items);
        });
    });
});
