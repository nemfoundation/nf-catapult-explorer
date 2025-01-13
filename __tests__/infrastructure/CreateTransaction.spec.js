import Helper from '../../src/helper';
import { CreateTransaction, NamespaceService } from '../../src/infrastructure';
import http from '../../src/infrastructure/http';
import TestHelper from '../TestHelper';
import { restore, stub } from 'sinon';
import {
	Account,
	Convert,
	Mosaic,
	MosaicId,
	MosaicNonce,
	NamespaceId,
	NamespaceName,
	NetworkType,
	UInt64
} from 'symbol-sdk';

/* Mock metadata transaction dto */
const mockTransactionMetadataDTO = {
	type: 16708,
	network: 152,
	version: 1,
	maxFee: '43568',
	deadline: '8324113451',
	signature: 'DFF9EAE5F5CC7AD610F979CC23111FED3109D2C357BA1CD7648ABAE8F96DA0E934294CF' +
		'898868B74D0B87BAE6E37FAD3BFBDA34FE90A1DA5F421D78F78B8F108',
	signerPublicKey: '6A0BB107BB60EFC93125936BE35B7491B59D2A8F73B7B77CF391A95E720A9CE5',
	transactionInfo: {
		height: 201145,
		aggregateHash: '8DC8BDFED772B7F0094ADFBDB0593E51B1C67FB80796C84FD4C3AF3F50E57994',
		aggregateId: '621E7F1D051921634349F222'
	},
	scopedMetadataKey: UInt64.fromHex('B3E6950880062C6D'),
	valueSizeDelta: 20,
	valueSize: 23
};

describe('CreateTransaction', () => {
	const randomAddress = Account.generateNewAccount(NetworkType.TEST_NET).address;
	const metadataValue = Convert.hexToUint8('00000020E6B189E5AD973B2070696E79696E3A2068C3A0');

	afterEach(restore);

	it('returns accountMetadata', async () => {
		// Arrange:
		const mockAccountMetadata = {
			...mockTransactionMetadataDTO,
			value: metadataValue,
			targetAddress: randomAddress
		};

		// Act:
		const accountMetadataObject = await CreateTransaction.accountMetadata(mockAccountMetadata);

		// Assert:
		expect(accountMetadataObject.transactionBody).toEqual({
			transactionType: mockAccountMetadata.type,
			scopedMetadataKey: mockAccountMetadata.scopedMetadataKey.toHex(),
			targetAddress: randomAddress.plain(),
			metadataValue: '00000020E6B189E5AD973B2070696E79696E3A2068C3A0 (Text: \x00\x00\x00 汉字; pinyin: hà)',
			valueSizeDelta: mockAccountMetadata.valueSizeDelta
		});
	});

	it('returns mosaicMetadata', async () => {
		// Arrange:
		const mockMosaicMetadata = {
			...mockTransactionMetadataDTO,
			value: metadataValue,
			targetAddress: randomAddress,
			targetMosaicId: new MosaicId('7F2D26E89342D398')
		};

		// Act:
		const mosaicMetadataObject = await CreateTransaction.mosaicMetadata(mockMosaicMetadata, {
			mosaicNames: [{
				names: [],
				mosaicId: '7F2D26E89342D398'
			}],
			unresolvedMosaicsMap: {
				'7F2D26E89342D398': '7F2D26E89342D398'
			}
		});

		// Assert:
		expect(mosaicMetadataObject.transactionBody).toEqual({
			transactionType: mockMosaicMetadata.type,
			scopedMetadataKey: mockMosaicMetadata.scopedMetadataKey.toHex(),
			targetAddress: randomAddress.plain(),
			metadataValue: '00000020E6B189E5AD973B2070696E79696E3A2068C3A0 (Text: \x00\x00\x00 汉字; pinyin: hà)',
			valueSizeDelta: mockMosaicMetadata.valueSizeDelta,
			targetMosaicId: mockMosaicMetadata.targetMosaicId.toHex(),
			targetMosaicAliasNames: ['N/A']
		});
	});

	it('returns namespaceMetadata', async () => {
		// Arrange:
		const namespace = {
			namespaceId: new NamespaceId('mock-namespace'),
			name: 'mock-namespace',
			parentId: 'N/A'
		};

		const mockNamespaceMetadata = {
			...mockTransactionMetadataDTO,
			value: metadataValue,
			targetAddress: randomAddress,
			targetNamespaceId: namespace.namespaceId
		};

		const getNamespacesNamesStub = stub(NamespaceService, 'getNamespacesNames');
		getNamespacesNamesStub.returns(Promise.resolve([namespace]));

		// Act:
		const namespaceMetadataObject = await CreateTransaction.namespaceMetadata(mockNamespaceMetadata);

		// Assert:
		expect(namespaceMetadataObject.transactionBody).toEqual({
			transactionType: mockNamespaceMetadata.type,
			scopedMetadataKey: mockNamespaceMetadata.scopedMetadataKey.toHex(),
			targetAddress: randomAddress.plain(),
			metadataValue: '00000020E6B189E5AD973B2070696E79696E3A2068C3A0 (Text: \x00\x00\x00 汉字; pinyin: hà)',
			valueSizeDelta: mockNamespaceMetadata.valueSizeDelta,
			targetNamespaceId: mockNamespaceMetadata.targetNamespaceId.toHex(),
			namespaceName: [namespace]
		});
	});

	it('resolves mosaics and addresses in transfer transaction', async () =>  {
		// Arrange:
		const mockTransferTransaction = {
			...TestHelper.mockTransaction({
				height: 1,
				timestamp: 10
			}),
			mosaics: [
				new Mosaic(new NamespaceId(http.networkCurrency.namespaceName), UInt64.fromUint(20)),
				new Mosaic(new MosaicId(http.networkCurrency.mosaicId), UInt64.fromUint(1))
			]
		};

		stub(Helper, 'resolvedAddress').returns(Promise.resolve(mockTransferTransaction.recipientAddress));

		// Act:
		const transactionObject = await CreateTransaction.transferTransaction(mockTransferTransaction, {
			mosaicInfos: [],
			mosaicNames: [],
			unresolvedMosaicsMap: {
				'E74B99BA41F4AFEE': '6BED913FA20223F8',
				'6BED913FA20223F8': '6BED913FA20223F8'
			}
		});

		// Assert:
		expect(transactionObject.transactionBody).toEqual({
			transactionType: 16724,
			message: mockTransferTransaction.message,
			recipient: mockTransferTransaction.recipientAddress,
			mosaics: [{
				amount: '0.000021',
				mosaicAliasName: 'symbol.xym',
				mosaicId: '6BED913FA20223F8',
				rawAmount: UInt64.fromUint(21)
			}]
		});
	});

	it('resolves mosaics in mosaic supply revocation transaction', async () =>  {
		// Arrange:
		const mockTestMosaic = {
			idHex: '6B2E9EAF2632AEC8',
			namespaceName: 'reclaim_mosaic'
		};

		const mockMosaicSupplyRevocationTransaction = TestHelper.mockMosaicSupplyRevocationTransaction(new Mosaic(
			new MosaicId(mockTestMosaic.idHex),
			UInt64.fromUint(1)
		));

		const mockMosaicInfos = [
			TestHelper.mockMosaicInfo(mockTestMosaic.idHex, 'TC46AZWUIZYZ2WVGLVEZYNZHSIFAD3AFDPUJMEA', 10, 0)
		];

		const mockMosaicNames = [
			{
				names: [new NamespaceName(new NamespaceId(mockTestMosaic.namespaceName), mockTestMosaic.namespaceName)],
				mosaicId: mockTestMosaic.idHex
			}
		];

		// Act:
		const transactionObject = await CreateTransaction.mosaicSupplyRevocation(mockMosaicSupplyRevocationTransaction, {
			mosaicInfos: mockMosaicInfos,
			mosaicNames: mockMosaicNames,
			unresolvedMosaicsMap: {
				'6B2E9EAF2632AEC8': '6B2E9EAF2632AEC8'
			}
		});

		// Assert:
		expect(transactionObject.transactionBody).toEqual({
			transactionType: 17229,
			address: mockMosaicSupplyRevocationTransaction.sourceAddress.address,
			mosaics: [{
				amount: '1',
				mosaicAliasName: 'reclaim_mosaic',
				mosaicId: '6B2E9EAF2632AEC8',
				rawAmount: UInt64.fromUint(1)
			}]
		});
	});

	it('resolves mosaics in hash lock transaction', async () =>  {
		// Arrange:
		const mockLockFundsTransaction = TestHelper.mockLockFundsTransaction();

		// Act:
		const transactionObject = await CreateTransaction.hashLock(mockLockFundsTransaction, {
			mosaicInfos: [],
			mosaicNames: [],
			unresolvedMosaicsMap: {
				'E74B99BA41F4AFEE': '6BED913FA20223F8',
				'6BED913FA20223F8': '6BED913FA20223F8'
			}
		});

		// Assert:
		expect(transactionObject.transactionBody).toEqual({
			transactionType: 16712,
			duration: 10,
			hash: mockLockFundsTransaction.hash,
			mosaics: [{
				amount: '0.000010',
				mosaicAliasName: 'symbol.xym',
				mosaicId: '6BED913FA20223F8',
				rawAmount: UInt64.fromUint(10)
			}]
		});
	});

	it('resolves mosaics and addresses in secret lock transaction', async () =>  {
		// Arrange:
		const mockTestSecretLockMosaic = {
			idHex: '22D2D90A27738AA0',
			namespaceName: 'secret_lock_mosaic'
		};

		const mockSecretLockTransaction = TestHelper.mockSecretLockTransaction(new Mosaic(
			new NamespaceId(mockTestSecretLockMosaic.namespaceName),
			UInt64.fromUint(20)
		));

		stub(Helper, 'resolvedAddress').returns(Promise.resolve(mockSecretLockTransaction.recipientAddress));

		const mockMosaicInfos = [
			TestHelper.mockMosaicInfo(mockTestSecretLockMosaic.idHex, 'TC46AZWUIZYZ2WVGLVEZYNZHSIFAD3AFDPUJMEA', 10, 0)
		];

		const mockMosaicNames = [
			{
				names: [new NamespaceName(new NamespaceId(mockTestSecretLockMosaic.namespaceName), mockTestSecretLockMosaic.namespaceName)],
				mosaicId: mockTestSecretLockMosaic.idHex
			}
		];

		// Act:
		const transactionObject = await CreateTransaction.secretLock(mockSecretLockTransaction, {
			mosaicInfos: mockMosaicInfos,
			mosaicNames: mockMosaicNames,
			unresolvedMosaicsMap: {
				'DEBBC3DA600F2B48': '22D2D90A27738AA0'
			}
		});

		// Assert:
		expect(transactionObject.transactionBody).toEqual({
			transactionType: 16722,
			duration: 10,
			hashAlgorithm: 'Sha3 256',
			secret: mockSecretLockTransaction.secret,
			recipient: mockSecretLockTransaction.recipientAddress,
			mosaics: [{
				amount: '20',
				mosaicAliasName: 'secret_lock_mosaic',
				mosaicId: '22D2D90A27738AA0',
				rawAmount: UInt64.fromUint(20)
			}]
		});
	});

	it('returns mosaicDefinition', async () => {
		// Arrange:
		const mockMosaicDefinition = {
			type: 16717,
			network: 152,
			version: 1,
			mosaicId: new MosaicId('7F2D26E89342D398'),
			divisibility: 0,
			duration: UInt64.fromUint(1000),
			nonce: MosaicNonce.createRandom(),
			flags: {
				supplyMutable: false,
				transferable: true,
				restrictable: true,
				revokable: true
			}
		};

		// Act:
		const mosaicDefinitionObject = await CreateTransaction.mosaicDefinition(mockMosaicDefinition, {
			unresolvedMosaicsMap: {
				'7F2D26E89342D398': '7F2D26E89342D398'
			}
		});

		// Assert:
		expect(mosaicDefinitionObject.transactionBody).toEqual({
			transactionType: mockMosaicDefinition.type,
			recipient: 'TATYW7IJN2TDBINTESRU66HHS5HMC4YVW7GGDRA',
			mosaicId: '7F2D26E89342D398',
			divisibility: 0,
			duration: 1000,
			nonce: mockMosaicDefinition.nonce.toHex(),
			supplyMutable: false,
			transferable: true,
			restrictable: true,
			revokable: true
		});
	});

	const assertMosaicSupplyChange = async (action, expectedAction) => {
		// Arrange:
		const mockMosaicSupplyChange = {
			type: 16973,
			mosaicId: new MosaicId('7F2D26E89342D398'),
			action: action,
			delta: UInt64.fromUint(100)
		};

		// Act:
		const mosaicSupplyChangeObject = await CreateTransaction.mosaicSupplyChange(mockMosaicSupplyChange, {
			unresolvedMosaicsMap: {
				'7F2D26E89342D398': '7F2D26E89342D398'
			}
		});

		// Assert:
		expect(mosaicSupplyChangeObject.transactionBody).toEqual({
			transactionType: mockMosaicSupplyChange.type,
			mosaicId: '7F2D26E89342D398',
			action: expectedAction,
			delta: 100
		});
	};

	it('returns mosaicSupplyChange in increase action', async () => {
		await assertMosaicSupplyChange(1, 'Increase');
	});

	it('returns mosaicSupplyChange in decrease action', async () => {
		await assertMosaicSupplyChange(0, 'Decrease');
	});

	it('returns mosaicAddressRestriction', async () => {
		// Arrange:
		const mockMosaicAddressRestriction = {
			type: 16977,
			mosaicId: new MosaicId('7F2D26E89342D398'),
			targetAddress: randomAddress,
			restrictionKey: UInt64.fromUint(1),
			previousRestrictionValue: UInt64.fromUint(10),
			newRestrictionValue: UInt64.fromUint(20),
			transactionInfo: {
				height: UInt64.fromUint(1)
			}
		};

		// Act:
		const mosaicAddressRestrictionObject = await CreateTransaction.mosaicAddressRestriction(mockMosaicAddressRestriction, {
			mosaicNames: [{
				names: [],
				mosaicId: '7F2D26E89342D398'
			}],
			unresolvedMosaicsMap: {
				'7F2D26E89342D398': '7F2D26E89342D398'
			}
		});

		// Assert:
		expect(mosaicAddressRestrictionObject.transactionBody).toEqual({
			transactionType: mockMosaicAddressRestriction.type,
			mosaicId: '7F2D26E89342D398',
			mosaicAliasNames: ['N/A'],
			targetAddress: randomAddress.plain(),
			restrictionKey: '0000000000000001',
			previousRestrictionValue: '10',
			newRestrictionValue: '20'
		});
	});
});
