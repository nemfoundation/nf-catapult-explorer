import Helper from '../../src/helper';
import { CreateTransaction, LockService, TransactionService } from '../../src/infrastructure';
import http from '../../src/infrastructure/http';
import TestHelper from '../TestHelper';
import { restore, stub } from 'sinon';
import { Account, MosaicId, NetworkType, TransactionGroup, UInt64 } from 'symbol-sdk';

describe('Transaction Service', () => {
	afterEach(restore);

	describe('getTransactionInfo', () => {
		const transferTransactionFromSDK = {
			deadline: '2022-02-28 17:55:31',
			maxFee: '0.005000',
			transactionType: 16724,
			transactionBody: {
				transactionType: 16724,
				message: {
					type: -1,
					payload: ''
				},
				recipient: 'TDCPHIHQPN6WKJJIUCOFISJCB4NULEZOS4NCQQQ',
				mosaics: [
					{
						amount: '5',
						mosaicId: '7F2D26E89342D398',
						mosaicAliasName: [
							'teria.revokable'
						]
					}
				]
			}
		};

		it('returns transfer transaction with paid fee', async () => {
			// Arrange:
			const transactionStatus = {
				message: 'confirmed',
				detail: {
					code: 'Success'
				}
			};

			const transferTransaction = TestHelper.mockTransaction({
				height: UInt64.fromUint(198327),
				timestamp: UInt64.fromUint(1646063763)
			});

			const transactionFromSDK = {
				...transferTransaction,
				...transferTransactionFromSDK
			};

			stub(TransactionService, 'getTransactionStatus').returns(Promise.resolve(transactionStatus));

			stub(TransactionService, 'getTransaction').returns(Promise.resolve(transferTransaction));

			stub(TransactionService, 'createTransactionFromSDK').returns(Promise.resolve(transactionFromSDK));

			// Act:
			const {
				blockHeight,
				transactionBody,
				transactionHash,
				effectiveFee,
				timestamp,
				status,
				confirm
			} = await TransactionService.getTransactionInfo('541B506C91003C248CF09C6FB3BC94D0A26B8197B76B2827DDE3AF3A0ED3E350');

			// Assert:
			const { payloadSize, transactionInfo } = transferTransaction;

			expect(blockHeight).toEqual(transactionInfo.height);
			expect(transactionHash).toEqual(transactionInfo.hash);
			expect(effectiveFee).toEqual(Helper.toNetworkCurrency(payloadSize * transactionInfo.feeMultiplier));
			expect(timestamp).toEqual(1646063763);
			expect(transactionBody).toEqual(transactionFromSDK.transactionBody);
			expect(status).toEqual(transactionStatus.detail.code);
			expect(confirm).toEqual(transactionStatus.message);
		});

		it('returns partial transaction with max fee', async () => {
			// Arrange:
			const transactionStatus = {
				message: 'partial',
				detail: {
					code: 'Success'
				}
			};

			const innerTransaction = TestHelper.mockTransaction({
				height: 0,
				timestamp: 0
			});

			const partialTransaction = TestHelper.createPartialAggregateTransaction([], [innerTransaction]);

			const partialTransactionFromSDK = {
				...partialTransaction,
				deadline: 1665914320,
				maxFee: '0.050000',
				type: 16961,
				innerTransactions: [
					{
						...innerTransaction,
						deadline: '2022-02-28 17:55:31',
						transactionType: 16724,
						transactionBody: {
							transactionType: 16724,
							message: {
								type: -1,
								payload: ''
							},
							recipient: 'TDCPHIHQPN6WKJJIUCOFISJCB4NULEZOS4NCQQQ',
							mosaics: [
								{
									amount: '5',
									mosaicId: '7F2D26E89342D398',
									mosaicAliasName: [
										'teria.revokable'
									]
								}
							]
						}
					}
				],
				transactionInfo: {
					height: 0,
					index: 0,
					timestamp: 1637848847,
					feeMultiplier: 0,
					hash: 'C3A9E202E14EA5890914F9884627A280CDD7571C0E3EEE0D6FF7788626136D4B',
					merkleComponentHash: '0000000000000000000000000000000000000000000000000000000000000000'
				},
				transactionBody: {
					transactionType: 16961
				}
			};

			stub(TransactionService, 'getTransactionStatus').returns(Promise.resolve(transactionStatus));

			stub(TransactionService, 'getTransaction').returns(Promise.resolve(partialTransaction));

			stub(TransactionService, 'createTransactionFromSDK').returns(Promise.resolve(partialTransactionFromSDK));

			// Act:
			const {
				blockHeight,
				transactionBody,
				transactionHash,
				maxFee,
				timestamp,
				status,
				confirm
			} = await TransactionService.getTransactionInfo('C3A9E202E14EA5890914F9884627A280CDD7571C0E3EEE0D6FF7788626136D4B');

			// Assert:
			expect(blockHeight).toEqual(undefined);
			expect(transactionHash).toEqual(partialTransactionFromSDK.transactionInfo.hash);
			expect(maxFee).toEqual(partialTransactionFromSDK.maxFee);
			expect(timestamp).toEqual(partialTransactionFromSDK.transactionInfo.timestamp);
			expect(transactionBody).toEqual(partialTransactionFromSDK.transactionBody);
			expect(status).toEqual(transactionStatus.detail.code);
			expect(confirm).toEqual(transactionStatus.message);
		});

		it('returns unconfirmed transfer transaction with max fee', async () => {
			// Arrange:
			const transactionStatus = {
				message: 'unconfirmed',
				detail: {
					code: 'Success'
				}
			};

			const transferTransaction = TestHelper.mockTransaction({
				height: 0,
				timestamp: 0
			});

			const transactionFromSDK = {
				...transferTransaction,
				...transferTransactionFromSDK
			};

			stub(TransactionService, 'getTransactionStatus').returns(Promise.resolve(transactionStatus));

			stub(TransactionService, 'getTransaction').returns(Promise.resolve(transferTransaction));

			stub(TransactionService, 'createTransactionFromSDK').returns(Promise.resolve(transactionFromSDK));

			// Act:
			const {
				blockHeight,
				transactionBody,
				transactionHash,
				maxFee,
				timestamp,
				status,
				confirm
			} = await TransactionService.getTransactionInfo('541B506C91003C248CF09C6FB3BC94D0A26B8197B76B2827DDE3AF3A0ED3E350');

			// Assert:
			expect(blockHeight).toEqual(undefined);
			expect(transactionHash).toEqual(transferTransaction.transactionInfo.hash);
			expect(maxFee).toEqual(transactionFromSDK.maxFee);
			expect(timestamp).toEqual(0);
			expect(transactionBody).toEqual(transactionFromSDK.transactionBody);
			expect(status).toEqual(transactionStatus.detail.code);
			expect(confirm).toEqual(transactionStatus.message);
		});
	});

	describe('getTransactionList', () => {
		const runBasicGetTransactionsListTests = (transactionGroup, blockInfo) => {
			it(`returns ${transactionGroup} transactions`, async () => {
				// Arrange:
				const pageInfo = {
					pageNumber: 1,
					pageSize: 10
				};

				const mockSearchTransactions = {
					...pageInfo,
					data: [
						TestHelper.mockTransaction(blockInfo)
					]
				};

				const searchTransactions = stub(TransactionService, 'searchTransactions');
				searchTransactions.returns(Promise.resolve(mockSearchTransactions));

				// Act:
				const transactionList = await TransactionService.getTransactionList(pageInfo, {
					group: transactionGroup
				});

				// Assert:
				if (transactionGroup === TransactionGroup.Confirmed)
					expect(transactionList.totalRecords).toEqual(500);

				expect(transactionList.pageNumber).toEqual(pageInfo.pageNumber);
				expect(transactionList.pageSize).toEqual(pageInfo.pageSize);
				expect(transactionList.data).toHaveLength(1);
				transactionList.data.forEach(transaction => {
					expect(transaction).toHaveProperty('transactionHash');
					expect(transaction).toHaveProperty('transactionType');
					expect(transaction).toHaveProperty('recipient');
					expect(transaction).toHaveProperty('extendGraphicValue');

					if (transactionGroup === TransactionGroup.Confirmed) {
						const { payloadSize, transactionInfo } = transaction;
						expect(transaction.effectiveFee).toBe(Helper.toNetworkCurrency(payloadSize * transactionInfo.feeMultiplier));
						expect(transaction).not.toHaveProperty('maxFee');
					} else {
						expect(transaction.maxFee).toBe('1.000000');
						expect(transaction).not.toHaveProperty('effectiveFee');
					}
				});
			});
		};

		// Arrange:
		[
			{
				transactionGroup: TransactionGroup.Confirmed,
				blockInfo: {
					height: UInt64.fromUint(198327),
					timestamp: UInt64.fromUint(1646063763)
				}
			},
			{
				transactionGroup: TransactionGroup.Unconfirmed,
				blockInfo: {
					height: UInt64.fromUint(0),
					timestamp: UInt64.fromUint(1646063763)
				}
			},
			{
				transactionGroup: TransactionGroup.Partial,
				blockInfo: {
					height: UInt64.fromUint(0),
					timestamp: UInt64.fromUint(1646063763)
				}
			}].forEach(({transactionGroup, blockInfo}) => {
			runBasicGetTransactionsListTests(transactionGroup, blockInfo);
		});
	});

	describe('getHashLockInfo', () => {
		it('resolves mosaics in hash lock info when transaction hash provided', async () => {
			// Arrange:
			const { address } = TestHelper.generateAccount(1)[0];

			const mockHashLock = {
				amount: UInt64.fromUint(10),
				endHeight: 10,
				hash: '41A1F78E82A80A6C6A845BE49BFC3DD3E05040ED72E598E7ED1BD80A9C691E0E',
				mosaicId: new MosaicId(http.networkCurrency.mosaicId),
				ownerAddress: address.plain(),
				recordId: '631FA269464297FBEBEFE0ED',
				status: 'Unused',
				version: 1
			};

			stub(LockService, 'getHashLock').returns(Promise.resolve(mockHashLock));

			// Act:
			const hashLockInfo = await TransactionService.getHashLockInfo(mockHashLock.hash);

			// Assert:
			expect(hashLockInfo).toEqual({
				...mockHashLock,
				mosaics: [{
					amount: '0.000010',
					mosaicAliasName: 'symbol.xym',
					mosaicId: '6BED913FA20223F8',
					rawAmount: UInt64.fromUint(10)
				}]
			});
		});
	});

	describe('createStandaloneTransactionFromSDK', () => {
		const commonTransactionDTO = {
			deadline: {
				adjustedValue: 8266897456
			},
			maxFee: UInt64.fromUint(1000000),
			signer: {
				address: Account.generateNewAccount(NetworkType.TEST_NET).address
			},
			transactionInfo: {}
		};

		const assertTransactionCreation = async (transactionType, transactionTypeName, expectedParams) => {
			// Arrange:
			const mockTransactionDTO = {
				...commonTransactionDTO,
				type: transactionType
			};

			jest.spyOn(CreateTransaction, transactionTypeName).mockResolvedValue();

			// Act:
			await TransactionService.createStandaloneTransactionFromSDK(mockTransactionDTO, {
				mosaicInfos: [],
				mosaicNames: [],
				unresolvedMosaicsMap: {}
			});

			// Assert:
			expect(CreateTransaction[transactionTypeName]).toHaveBeenCalledWith({
				deadline: 1646115744,
				maxFee: '1.000000',
				signer: mockTransactionDTO.signer.address.plain(),
				transactionInfo: {},
				transactionType: transactionType,
				type: transactionType
			}, expectedParams);
		};

		it('called mosaic definition', async () => {
			await assertTransactionCreation(16717, 'mosaicDefinition', {
				unresolvedMosaicsMap: {}
			});
		});

		it('called mosaic supply change', async () => {
			await assertTransactionCreation(16973, 'mosaicSupplyChange', {
				unresolvedMosaicsMap: {}
			});
		});

		it('called mosaic address restriction', async () => {
			await assertTransactionCreation(16977, 'mosaicAddressRestriction', {
				mosaicNames: [],
				unresolvedMosaicsMap: {}
			});
		});

		it('called mosaic metadata', async () => {
			await assertTransactionCreation(16964, 'mosaicMetadata', {
				mosaicNames: [],
				unresolvedMosaicsMap: {}
			});
		});
	});
});
