
package com.dian.client;

import java.math.BigDecimal;
import java.math.BigInteger;
import javax.xml.bind.JAXBElement;
import javax.xml.bind.annotation.XmlElementDecl;
import javax.xml.bind.annotation.XmlRegistry;
import javax.xml.datatype.Duration;
import javax.xml.datatype.XMLGregorianCalendar;
import javax.xml.namespace.QName;


/**
 * This object contains factory methods for each 
 * Java content interface and Java element interface 
 * generated in the com.dian.client package. 
 * <p>An ObjectFactory allows you to programatically 
 * construct new instances of the Java representation 
 * for XML content. The Java representation of XML 
 * content can consist of schema derived interfaces 
 * and classes representing the binding of schema 
 * type definitions, element declarations and model 
 * groups.  Factory methods for each of these are 
 * provided in this class.
 * 
 */
@XmlRegistry
public class ObjectFactory {

    private final static QName _UploadDocumentResponse_QNAME = new QName("http://schemas.datacontract.org/2004/07/UploadDocumentResponse", "UploadDocumentResponse");
    private final static QName _ArrayOfEvento_QNAME = new QName("http://schemas.datacontract.org/2004/07/Evento", "ArrayOfEvento");
    private final static QName _ArrayOfNota_QNAME = new QName("http://schemas.datacontract.org/2004/07/Nota", "ArrayOfNota");
    private final static QName _Duration_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "duration");
    private final static QName _ArrayOfstring_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/Arrays", "ArrayOfstring");
    private final static QName _Long_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "long");
    private final static QName _ArrayOfValidacionDoc_QNAME = new QName("http://schemas.datacontract.org/2004/07/ValidacionDoc", "ArrayOfValidacionDoc");
    private final static QName _DateTime_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "dateTime");
    private final static QName _TotalEImpuestos_QNAME = new QName("http://schemas.datacontract.org/2004/07/TotalEImpuestos", "TotalEImpuestos");
    private final static QName _String_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "string");
    private final static QName _UnsignedInt_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "unsignedInt");
    private final static QName _Char_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "char");
    private final static QName _Short_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "short");
    private final static QName _XmlParamsResponseTrackId_QNAME = new QName("http://schemas.datacontract.org/2004/07/XmlParamsResponseTrackId", "XmlParamsResponseTrackId");
    private final static QName _DocumentInfoResponse_QNAME = new QName("http://schemas.datacontract.org/2004/07/DocumentInfoResponse", "DocumentInfoResponse");
    private final static QName _Nota_QNAME = new QName("http://schemas.datacontract.org/2004/07/Nota", "Nota");
    private final static QName _Boolean_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "boolean");
    private final static QName _EventResponse_QNAME = new QName("http://schemas.datacontract.org/2004/07/EventResponse", "EventResponse");
    private final static QName _NumeroDocumento_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumeroDocumento", "NumeroDocumento");
    private final static QName _Int_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "int");
    private final static QName _ArrayOfKeyValueOfintstring_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/Arrays", "ArrayOfKeyValueOfintstring");
    private final static QName _ArrayOfXmlParamsResponseTrackId_QNAME = new QName("http://schemas.datacontract.org/2004/07/XmlParamsResponseTrackId", "ArrayOfXmlParamsResponseTrackId");
    private final static QName _QName_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "QName");
    private final static QName _UnsignedLong_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "unsignedLong");
    private final static QName _UnsignedByte_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "unsignedByte");
    private final static QName _UnsignedShort_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "unsignedShort");
    private final static QName _ArrayOfDianResponse_QNAME = new QName("http://schemas.datacontract.org/2004/07/DianResponse", "ArrayOfDianResponse");
    private final static QName _NumberRangeResponse_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumberRangeResponse", "NumberRangeResponse");
    private final static QName _AdquirienteResponse_QNAME = new QName("http://schemas.datacontract.org/2004/07/Gosocket.Dian.Services.Utils.Common", "AdquirienteResponse");
    private final static QName _Documento_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "Documento");
    private final static QName _ArrayOfReferenciaDocumento_QNAME = new QName("http://schemas.datacontract.org/2004/07/ReferenciaDocumento", "ArrayOfReferenciaDocumento");
    private final static QName _ArrayOfNumberRangeResponse_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumberRangeResponse", "ArrayOfNumberRangeResponse");
    private final static QName _LegitimoTenedor_QNAME = new QName("http://schemas.datacontract.org/2004/07/LegitimoTenedor", "LegitimoTenedor");
    private final static QName _Float_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "float");
    private final static QName _ValidacionDoc_QNAME = new QName("http://schemas.datacontract.org/2004/07/ValidacionDoc", "ValidacionDoc");
    private final static QName _ReferenciaDocumento_QNAME = new QName("http://schemas.datacontract.org/2004/07/ReferenciaDocumento", "ReferenciaDocumento");
    private final static QName _DianResponse_QNAME = new QName("http://schemas.datacontract.org/2004/07/DianResponse", "DianResponse");
    private final static QName _AnyType_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "anyType");
    private final static QName _NumberRangeResponseList_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumberRangeResponseList", "NumberRangeResponseList");
    private final static QName _ConceptoCorreccion_QNAME = new QName("http://schemas.datacontract.org/2004/07/ConceptoCorreccion", "ConceptoCorreccion");
    private final static QName _Guid_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "guid");
    private final static QName _Decimal_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "decimal");
    private final static QName _ArrayOfDocumento_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "ArrayOfDocumento");
    private final static QName _Entidad_QNAME = new QName("http://schemas.datacontract.org/2004/07/Entidad", "Entidad");
    private final static QName _Base64Binary_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "base64Binary");
    private final static QName _Evento_QNAME = new QName("http://schemas.datacontract.org/2004/07/Evento", "Evento");
    private final static QName _AnyURI_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "anyURI");
    private final static QName _ExchangeEmailResponse_QNAME = new QName("http://schemas.datacontract.org/2004/07/ExchangeEmailResponse", "ExchangeEmailResponse");
    private final static QName _Byte_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "byte");
    private final static QName _Double_QNAME = new QName("http://schemas.microsoft.com/2003/10/Serialization/", "double");
    private final static QName _ExchangeEmailResponseStatusCode_QNAME = new QName("http://schemas.datacontract.org/2004/07/ExchangeEmailResponse", "StatusCode");
    private final static QName _ExchangeEmailResponseCsvBase64Bytes_QNAME = new QName("http://schemas.datacontract.org/2004/07/ExchangeEmailResponse", "CsvBase64Bytes");
    private final static QName _ExchangeEmailResponseMessage_QNAME = new QName("http://schemas.datacontract.org/2004/07/ExchangeEmailResponse", "Message");
    private final static QName _NumberRangeResponseListOperationCode_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumberRangeResponseList", "OperationCode");
    private final static QName _NumberRangeResponseListResponseList_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumberRangeResponseList", "ResponseList");
    private final static QName _NumberRangeResponseListOperationDescription_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumberRangeResponseList", "OperationDescription");
    private final static QName _GetReferenceNotesTrackId_QNAME = new QName("http://wcf.dian.colombia", "trackId");
    private final static QName _GetNumberingRangeResponseGetNumberingRangeResult_QNAME = new QName("http://wcf.dian.colombia", "GetNumberingRangeResult");
    private final static QName _GetAcquirerResponseGetAcquirerResult_QNAME = new QName("http://wcf.dian.colombia", "GetAcquirerResult");
    private final static QName _NumeroDocumentoFechaFirma_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumeroDocumento", "FechaFirma");
    private final static QName _NumeroDocumentoFolio_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumeroDocumento", "Folio");
    private final static QName _NumeroDocumentoFechaEmision_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumeroDocumento", "FechaEmision");
    private final static QName _NumeroDocumentoSerie_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumeroDocumento", "Serie");
    private final static QName _SendBillAttachmentAsyncFileName_QNAME = new QName("http://wcf.dian.colombia", "fileName");
    private final static QName _SendBillAttachmentAsyncContentFile_QNAME = new QName("http://wcf.dian.colombia", "contentFile");
    private final static QName _GetStatusZipResponseGetStatusZipResult_QNAME = new QName("http://wcf.dian.colombia", "GetStatusZipResult");
    private final static QName _EventoDescripcion_QNAME = new QName("http://schemas.datacontract.org/2004/07/Evento", "Descripcion");
    private final static QName _EventoEmisor_QNAME = new QName("http://schemas.datacontract.org/2004/07/Evento", "Emisor");
    private final static QName _EventoUUID_QNAME = new QName("http://schemas.datacontract.org/2004/07/Evento", "UUID");
    private final static QName _EventoValidacionesDoc_QNAME = new QName("http://schemas.datacontract.org/2004/07/Evento", "ValidacionesDoc");
    private final static QName _EventoNumeroDocumento_QNAME = new QName("http://schemas.datacontract.org/2004/07/Evento", "NumeroDocumento");
    private final static QName _EventoReferenciasDocumento_QNAME = new QName("http://schemas.datacontract.org/2004/07/Evento", "ReferenciasDocumento");
    private final static QName _EventoReceptor_QNAME = new QName("http://schemas.datacontract.org/2004/07/Evento", "Receptor");
    private final static QName _EventoCodigo_QNAME = new QName("http://schemas.datacontract.org/2004/07/Evento", "Codigo");
    private final static QName _ValidacionDocMensajeError_QNAME = new QName("http://schemas.datacontract.org/2004/07/ValidacionDoc", "MensajeError");
    private final static QName _ValidacionDocNombre_QNAME = new QName("http://schemas.datacontract.org/2004/07/ValidacionDoc", "Nombre");
    private final static QName _ValidacionDocStatus_QNAME = new QName("http://schemas.datacontract.org/2004/07/ValidacionDoc", "Status");
    private final static QName _ConceptoCorreccionNombre_QNAME = new QName("http://schemas.datacontract.org/2004/07/ConceptoCorreccion", "Nombre");
    private final static QName _ConceptoCorreccionCodigo_QNAME = new QName("http://schemas.datacontract.org/2004/07/ConceptoCorreccion", "Codigo");
    private final static QName _ConceptoCorreccionDescripcion_QNAME = new QName("http://schemas.datacontract.org/2004/07/ConceptoCorreccion", "Descripcion");
    private final static QName _NumberRangeResponseTechnicalKey_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumberRangeResponse", "TechnicalKey");
    private final static QName _NumberRangeResponseValidDateTo_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumberRangeResponse", "ValidDateTo");
    private final static QName _NumberRangeResponseResolutionDate_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumberRangeResponse", "ResolutionDate");
    private final static QName _NumberRangeResponseValidDateFrom_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumberRangeResponse", "ValidDateFrom");
    private final static QName _NumberRangeResponseResolutionNumber_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumberRangeResponse", "ResolutionNumber");
    private final static QName _NumberRangeResponsePrefix_QNAME = new QName("http://schemas.datacontract.org/2004/07/NumberRangeResponse", "Prefix");
    private final static QName _SendEventUpdateStatusResponseSendEventUpdateStatusResult_QNAME = new QName("http://wcf.dian.colombia", "SendEventUpdateStatusResult");
    private final static QName _SendBillAsyncResponseSendBillAsyncResult_QNAME = new QName("http://wcf.dian.colombia", "SendBillAsyncResult");
    private final static QName _EventResponseCode_QNAME = new QName("http://schemas.datacontract.org/2004/07/EventResponse", "Code");
    private final static QName _EventResponseMessage_QNAME = new QName("http://schemas.datacontract.org/2004/07/EventResponse", "Message");
    private final static QName _EventResponseValidationDate_QNAME = new QName("http://schemas.datacontract.org/2004/07/EventResponse", "ValidationDate");
    private final static QName _EventResponseXmlBytesBase64_QNAME = new QName("http://schemas.datacontract.org/2004/07/EventResponse", "XmlBytesBase64");
    private final static QName _DianResponseXmlBytes_QNAME = new QName("http://schemas.datacontract.org/2004/07/DianResponse", "XmlBytes");
    private final static QName _DianResponseStatusDescription_QNAME = new QName("http://schemas.datacontract.org/2004/07/DianResponse", "StatusDescription");
    private final static QName _DianResponseXmlBase64Bytes_QNAME = new QName("http://schemas.datacontract.org/2004/07/DianResponse", "XmlBase64Bytes");
    private final static QName _DianResponseXmlDocumentKey_QNAME = new QName("http://schemas.datacontract.org/2004/07/DianResponse", "XmlDocumentKey");
    private final static QName _DianResponseStatusMessage_QNAME = new QName("http://schemas.datacontract.org/2004/07/DianResponse", "StatusMessage");
    private final static QName _DianResponseXmlFileName_QNAME = new QName("http://schemas.datacontract.org/2004/07/DianResponse", "XmlFileName");
    private final static QName _DianResponseErrorMessage_QNAME = new QName("http://schemas.datacontract.org/2004/07/DianResponse", "ErrorMessage");
    private final static QName _DianResponseStatusCode_QNAME = new QName("http://schemas.datacontract.org/2004/07/DianResponse", "StatusCode");
    private final static QName _GetDocumentInfoUuid_QNAME = new QName("http://wcf.dian.colombia", "uuid");
    private final static QName _SendTestSetAsyncTestSetId_QNAME = new QName("http://wcf.dian.colombia", "testSetId");
    private final static QName _SendBillSyncResponseSendBillSyncResult_QNAME = new QName("http://wcf.dian.colombia", "SendBillSyncResult");
    private final static QName _NotaLegitimoTenedor_QNAME = new QName("http://schemas.datacontract.org/2004/07/Nota", "LegitimoTenedor");
    private final static QName _NotaNombreTipoDocumento_QNAME = new QName("http://schemas.datacontract.org/2004/07/Nota", "NombreTipoDocumento");
    private final static QName _NotaUUID_QNAME = new QName("http://schemas.datacontract.org/2004/07/Nota", "UUID");
    private final static QName _NotaValidacionesDoc_QNAME = new QName("http://schemas.datacontract.org/2004/07/Nota", "ValidacionesDoc");
    private final static QName _NotaNumeroDocumento_QNAME = new QName("http://schemas.datacontract.org/2004/07/Nota", "NumeroDocumento");
    private final static QName _NotaTotalEImpuestos_QNAME = new QName("http://schemas.datacontract.org/2004/07/Nota", "TotalEImpuestos");
    private final static QName _NotaEmisor_QNAME = new QName("http://schemas.datacontract.org/2004/07/Nota", "Emisor");
    private final static QName _NotaReceptor_QNAME = new QName("http://schemas.datacontract.org/2004/07/Nota", "Receptor");
    private final static QName _NotaConceptoCorreccion_QNAME = new QName("http://schemas.datacontract.org/2004/07/Nota", "ConceptoCorreccion");
    private final static QName _DocumentInfoResponseCompressedDocumentInfo_QNAME = new QName("http://schemas.datacontract.org/2004/07/DocumentInfoResponse", "CompressedDocumentInfo");
    private final static QName _DocumentInfoResponseStatusDescription_QNAME = new QName("http://schemas.datacontract.org/2004/07/DocumentInfoResponse", "StatusDescription");
    private final static QName _DocumentInfoResponseStatusCode_QNAME = new QName("http://schemas.datacontract.org/2004/07/DocumentInfoResponse", "StatusCode");
    private final static QName _DocumentInfoResponseDocumentInfo_QNAME = new QName("http://schemas.datacontract.org/2004/07/DocumentInfoResponse", "DocumentInfo");
    private final static QName _SendTestSetAsyncResponseSendTestSetAsyncResult_QNAME = new QName("http://wcf.dian.colombia", "SendTestSetAsyncResult");
    private final static QName _GetNumberingRangeAccountCode_QNAME = new QName("http://wcf.dian.colombia", "accountCode");
    private final static QName _GetNumberingRangeAccountCodeT_QNAME = new QName("http://wcf.dian.colombia", "accountCodeT");
    private final static QName _GetNumberingRangeSoftwareCode_QNAME = new QName("http://wcf.dian.colombia", "softwareCode");
    private final static QName _LegitimoTenedorFechaInscripcionComoTituloValor_QNAME = new QName("http://schemas.datacontract.org/2004/07/LegitimoTenedor", "FechaInscripcionComoTituloValor");
    private final static QName _LegitimoTenedorNombre_QNAME = new QName("http://schemas.datacontract.org/2004/07/LegitimoTenedor", "Nombre");
    private final static QName _GetExchangeEmailsResponseGetExchangeEmailsResult_QNAME = new QName("http://wcf.dian.colombia", "GetExchangeEmailsResult");
    private final static QName _GetAcquirerIdentificationType_QNAME = new QName("http://wcf.dian.colombia", "identificationType");
    private final static QName _GetAcquirerIdentificationNumber_QNAME = new QName("http://wcf.dian.colombia", "identificationNumber");
    private final static QName _XmlParamsResponseTrackIdDocumentKey_QNAME = new QName("http://schemas.datacontract.org/2004/07/XmlParamsResponseTrackId", "DocumentKey");
    private final static QName _XmlParamsResponseTrackIdSenderCode_QNAME = new QName("http://schemas.datacontract.org/2004/07/XmlParamsResponseTrackId", "SenderCode");
    private final static QName _XmlParamsResponseTrackIdXmlFileName_QNAME = new QName("http://schemas.datacontract.org/2004/07/XmlParamsResponseTrackId", "XmlFileName");
    private final static QName _XmlParamsResponseTrackIdProcessedMessage_QNAME = new QName("http://schemas.datacontract.org/2004/07/XmlParamsResponseTrackId", "ProcessedMessage");
    private final static QName _GetReferenceNotesResponseGetReferenceNotesResult_QNAME = new QName("http://wcf.dian.colombia", "GetReferenceNotesResult");
    private final static QName _ReferenciaDocumentoReceptor_QNAME = new QName("http://schemas.datacontract.org/2004/07/ReferenciaDocumento", "Receptor");
    private final static QName _ReferenciaDocumentoFecha_QNAME = new QName("http://schemas.datacontract.org/2004/07/ReferenciaDocumento", "Fecha");
    private final static QName _ReferenciaDocumentoDocumentTypeId_QNAME = new QName("http://schemas.datacontract.org/2004/07/ReferenciaDocumento", "DocumentTypeId");
    private final static QName _ReferenciaDocumentoDocumentTypeName_QNAME = new QName("http://schemas.datacontract.org/2004/07/ReferenciaDocumento", "DocumentTypeName");
    private final static QName _ReferenciaDocumentoUUID_QNAME = new QName("http://schemas.datacontract.org/2004/07/ReferenciaDocumento", "UUID");
    private final static QName _ReferenciaDocumentoDescripcion_QNAME = new QName("http://schemas.datacontract.org/2004/07/ReferenciaDocumento", "Descripcion");
    private final static QName _ReferenciaDocumentoEmisor_QNAME = new QName("http://schemas.datacontract.org/2004/07/ReferenciaDocumento", "Emisor");
    private final static QName _UploadDocumentResponseErrorMessageList_QNAME = new QName("http://schemas.datacontract.org/2004/07/UploadDocumentResponse", "ErrorMessageList");
    private final static QName _UploadDocumentResponseZipKey_QNAME = new QName("http://schemas.datacontract.org/2004/07/UploadDocumentResponse", "ZipKey");
    private final static QName _GetXmlByDocumentKeyResponseGetXmlByDocumentKeyResult_QNAME = new QName("http://wcf.dian.colombia", "GetXmlByDocumentKeyResult");
    private final static QName _DocumentoTotalEImpuestos_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "TotalEImpuestos");
    private final static QName _DocumentoNumeroDocumento_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "NumeroDocumento");
    private final static QName _DocumentoDocumentTags_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "DocumentTags");
    private final static QName _DocumentoDocumentTypeId_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "DocumentTypeId");
    private final static QName _DocumentoEstado_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "Estado");
    private final static QName _DocumentoLegitimoTenedor_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "LegitimoTenedor");
    private final static QName _DocumentoValidacionesDoc_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "ValidacionesDoc");
    private final static QName _DocumentoEmisor_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "Emisor");
    private final static QName _DocumentoDocumentTypeName_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "DocumentTypeName");
    private final static QName _DocumentoDocumentCode_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "DocumentCode");
    private final static QName _DocumentoUUID_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "UUID");
    private final static QName _DocumentoEventos_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "Eventos");
    private final static QName _DocumentoReferencias_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "Referencias");
    private final static QName _DocumentoDocumentDescription_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "DocumentDescription");
    private final static QName _DocumentoReceptor_QNAME = new QName("http://schemas.datacontract.org/2004/07/Documento", "Receptor");
    private final static QName _SendBillAttachmentAsyncResponseSendBillAttachmentAsyncResult_QNAME = new QName("http://wcf.dian.colombia", "SendBillAttachmentAsyncResult");
    private final static QName _GetStatusEventResponseGetStatusEventResult_QNAME = new QName("http://wcf.dian.colombia", "GetStatusEventResult");
    private final static QName _EntidadProcedencia_QNAME = new QName("http://schemas.datacontract.org/2004/07/Entidad", "Procedencia");
    private final static QName _EntidadNumeroDoc_QNAME = new QName("http://schemas.datacontract.org/2004/07/Entidad", "NumeroDoc");
    private final static QName _EntidadNombre_QNAME = new QName("http://schemas.datacontract.org/2004/07/Entidad", "Nombre");
    private final static QName _EntidadTipoDoc_QNAME = new QName("http://schemas.datacontract.org/2004/07/Entidad", "TipoDoc");
    private final static QName _GetStatusResponseGetStatusResult_QNAME = new QName("http://wcf.dian.colombia", "GetStatusResult");
    private final static QName _GetDocumentInfoResponseGetDocumentInfoResult_QNAME = new QName("http://wcf.dian.colombia", "GetDocumentInfoResult");
    private final static QName _SendNominaSyncResponseSendNominaSyncResult_QNAME = new QName("http://wcf.dian.colombia", "SendNominaSyncResult");
    private final static QName _AdquirienteResponseMessage_QNAME = new QName("http://schemas.datacontract.org/2004/07/Gosocket.Dian.Services.Utils.Common", "Message");
    private final static QName _AdquirienteResponseReceiverEmail_QNAME = new QName("http://schemas.datacontract.org/2004/07/Gosocket.Dian.Services.Utils.Common", "ReceiverEmail");
    private final static QName _AdquirienteResponseReceiverName_QNAME = new QName("http://schemas.datacontract.org/2004/07/Gosocket.Dian.Services.Utils.Common", "ReceiverName");
    private final static QName _AdquirienteResponseStatusCode_QNAME = new QName("http://schemas.datacontract.org/2004/07/Gosocket.Dian.Services.Utils.Common", "StatusCode");

    /**
     * Create a new ObjectFactory that can be used to create new instances of schema derived classes for package: com.dian.client
     * 
     */
    public ObjectFactory() {
    }

    /**
     * Create an instance of {@link ArrayOfKeyValueOfintstring }
     * 
     */
    public ArrayOfKeyValueOfintstring createArrayOfKeyValueOfintstring() {
        return new ArrayOfKeyValueOfintstring();
    }

    /**
     * Create an instance of {@link SendNominaSync }
     * 
     */
    public SendNominaSync createSendNominaSync() {
        return new SendNominaSync();
    }

    /**
     * Create an instance of {@link GetNumberingRangeResponse }
     * 
     */
    public GetNumberingRangeResponse createGetNumberingRangeResponse() {
        return new GetNumberingRangeResponse();
    }

    /**
     * Create an instance of {@link NumberRangeResponseList }
     * 
     */
    public NumberRangeResponseList createNumberRangeResponseList() {
        return new NumberRangeResponseList();
    }

    /**
     * Create an instance of {@link GetStatusResponse }
     * 
     */
    public GetStatusResponse createGetStatusResponse() {
        return new GetStatusResponse();
    }

    /**
     * Create an instance of {@link DianResponse }
     * 
     */
    public DianResponse createDianResponse() {
        return new DianResponse();
    }

    /**
     * Create an instance of {@link SendBillAttachmentAsync }
     * 
     */
    public SendBillAttachmentAsync createSendBillAttachmentAsync() {
        return new SendBillAttachmentAsync();
    }

    /**
     * Create an instance of {@link GetExchangeEmails }
     * 
     */
    public GetExchangeEmails createGetExchangeEmails() {
        return new GetExchangeEmails();
    }

    /**
     * Create an instance of {@link SendNominaSyncResponse }
     * 
     */
    public SendNominaSyncResponse createSendNominaSyncResponse() {
        return new SendNominaSyncResponse();
    }

    /**
     * Create an instance of {@link GetDocumentInfo }
     * 
     */
    public GetDocumentInfo createGetDocumentInfo() {
        return new GetDocumentInfo();
    }

    /**
     * Create an instance of {@link SendEventUpdateStatus }
     * 
     */
    public SendEventUpdateStatus createSendEventUpdateStatus() {
        return new SendEventUpdateStatus();
    }

    /**
     * Create an instance of {@link SendBillAsync }
     * 
     */
    public SendBillAsync createSendBillAsync() {
        return new SendBillAsync();
    }

    /**
     * Create an instance of {@link GetReferenceNotesResponse }
     * 
     */
    public GetReferenceNotesResponse createGetReferenceNotesResponse() {
        return new GetReferenceNotesResponse();
    }

    /**
     * Create an instance of {@link GetExchangeEmailsResponse }
     * 
     */
    public GetExchangeEmailsResponse createGetExchangeEmailsResponse() {
        return new GetExchangeEmailsResponse();
    }

    /**
     * Create an instance of {@link ExchangeEmailResponse }
     * 
     */
    public ExchangeEmailResponse createExchangeEmailResponse() {
        return new ExchangeEmailResponse();
    }

    /**
     * Create an instance of {@link GetStatusEventResponse }
     * 
     */
    public GetStatusEventResponse createGetStatusEventResponse() {
        return new GetStatusEventResponse();
    }

    /**
     * Create an instance of {@link SendTestSetAsync }
     * 
     */
    public SendTestSetAsync createSendTestSetAsync() {
        return new SendTestSetAsync();
    }

    /**
     * Create an instance of {@link GetXmlByDocumentKeyResponse }
     * 
     */
    public GetXmlByDocumentKeyResponse createGetXmlByDocumentKeyResponse() {
        return new GetXmlByDocumentKeyResponse();
    }

    /**
     * Create an instance of {@link EventResponse }
     * 
     */
    public EventResponse createEventResponse() {
        return new EventResponse();
    }

    /**
     * Create an instance of {@link GetStatus }
     * 
     */
    public GetStatus createGetStatus() {
        return new GetStatus();
    }

    /**
     * Create an instance of {@link SendBillSyncResponse }
     * 
     */
    public SendBillSyncResponse createSendBillSyncResponse() {
        return new SendBillSyncResponse();
    }

    /**
     * Create an instance of {@link SendEventUpdateStatusResponse }
     * 
     */
    public SendEventUpdateStatusResponse createSendEventUpdateStatusResponse() {
        return new SendEventUpdateStatusResponse();
    }

    /**
     * Create an instance of {@link GetStatusZipResponse }
     * 
     */
    public GetStatusZipResponse createGetStatusZipResponse() {
        return new GetStatusZipResponse();
    }

    /**
     * Create an instance of {@link ArrayOfDianResponse }
     * 
     */
    public ArrayOfDianResponse createArrayOfDianResponse() {
        return new ArrayOfDianResponse();
    }

    /**
     * Create an instance of {@link GetStatusEvent }
     * 
     */
    public GetStatusEvent createGetStatusEvent() {
        return new GetStatusEvent();
    }

    /**
     * Create an instance of {@link GetDocumentInfoResponse }
     * 
     */
    public GetDocumentInfoResponse createGetDocumentInfoResponse() {
        return new GetDocumentInfoResponse();
    }

    /**
     * Create an instance of {@link DocumentInfoResponse }
     * 
     */
    public DocumentInfoResponse createDocumentInfoResponse() {
        return new DocumentInfoResponse();
    }

    /**
     * Create an instance of {@link GetAcquirer }
     * 
     */
    public GetAcquirer createGetAcquirer() {
        return new GetAcquirer();
    }

    /**
     * Create an instance of {@link GetReferenceNotes }
     * 
     */
    public GetReferenceNotes createGetReferenceNotes() {
        return new GetReferenceNotes();
    }

    /**
     * Create an instance of {@link SendBillAsyncResponse }
     * 
     */
    public SendBillAsyncResponse createSendBillAsyncResponse() {
        return new SendBillAsyncResponse();
    }

    /**
     * Create an instance of {@link UploadDocumentResponse }
     * 
     */
    public UploadDocumentResponse createUploadDocumentResponse() {
        return new UploadDocumentResponse();
    }

    /**
     * Create an instance of {@link GetXmlByDocumentKey }
     * 
     */
    public GetXmlByDocumentKey createGetXmlByDocumentKey() {
        return new GetXmlByDocumentKey();
    }

    /**
     * Create an instance of {@link GetStatusZip }
     * 
     */
    public GetStatusZip createGetStatusZip() {
        return new GetStatusZip();
    }

    /**
     * Create an instance of {@link SendTestSetAsyncResponse }
     * 
     */
    public SendTestSetAsyncResponse createSendTestSetAsyncResponse() {
        return new SendTestSetAsyncResponse();
    }

    /**
     * Create an instance of {@link SendBillAttachmentAsyncResponse }
     * 
     */
    public SendBillAttachmentAsyncResponse createSendBillAttachmentAsyncResponse() {
        return new SendBillAttachmentAsyncResponse();
    }

    /**
     * Create an instance of {@link GetNumberingRange }
     * 
     */
    public GetNumberingRange createGetNumberingRange() {
        return new GetNumberingRange();
    }

    /**
     * Create an instance of {@link SendBillSync }
     * 
     */
    public SendBillSync createSendBillSync() {
        return new SendBillSync();
    }

    /**
     * Create an instance of {@link GetAcquirerResponse }
     * 
     */
    public GetAcquirerResponse createGetAcquirerResponse() {
        return new GetAcquirerResponse();
    }

    /**
     * Create an instance of {@link AdquirienteResponse }
     * 
     */
    public AdquirienteResponse createAdquirienteResponse() {
        return new AdquirienteResponse();
    }

    /**
     * Create an instance of {@link ArrayOfstring }
     * 
     */
    public ArrayOfstring createArrayOfstring() {
        return new ArrayOfstring();
    }

    /**
     * Create an instance of {@link ArrayOfXmlParamsResponseTrackId }
     * 
     */
    public ArrayOfXmlParamsResponseTrackId createArrayOfXmlParamsResponseTrackId() {
        return new ArrayOfXmlParamsResponseTrackId();
    }

    /**
     * Create an instance of {@link XmlParamsResponseTrackId }
     * 
     */
    public XmlParamsResponseTrackId createXmlParamsResponseTrackId() {
        return new XmlParamsResponseTrackId();
    }

    /**
     * Create an instance of {@link ArrayOfNumberRangeResponse }
     * 
     */
    public ArrayOfNumberRangeResponse createArrayOfNumberRangeResponse() {
        return new ArrayOfNumberRangeResponse();
    }

    /**
     * Create an instance of {@link NumberRangeResponse }
     * 
     */
    public NumberRangeResponse createNumberRangeResponse() {
        return new NumberRangeResponse();
    }

    /**
     * Create an instance of {@link ArrayOfDocumento }
     * 
     */
    public ArrayOfDocumento createArrayOfDocumento() {
        return new ArrayOfDocumento();
    }

    /**
     * Create an instance of {@link Documento }
     * 
     */
    public Documento createDocumento() {
        return new Documento();
    }

    /**
     * Create an instance of {@link ArrayOfNota }
     * 
     */
    public ArrayOfNota createArrayOfNota() {
        return new ArrayOfNota();
    }

    /**
     * Create an instance of {@link Nota }
     * 
     */
    public Nota createNota() {
        return new Nota();
    }

    /**
     * Create an instance of {@link ConceptoCorreccion }
     * 
     */
    public ConceptoCorreccion createConceptoCorreccion() {
        return new ConceptoCorreccion();
    }

    /**
     * Create an instance of {@link Entidad }
     * 
     */
    public Entidad createEntidad() {
        return new Entidad();
    }

    /**
     * Create an instance of {@link LegitimoTenedor }
     * 
     */
    public LegitimoTenedor createLegitimoTenedor() {
        return new LegitimoTenedor();
    }

    /**
     * Create an instance of {@link NumeroDocumento }
     * 
     */
    public NumeroDocumento createNumeroDocumento() {
        return new NumeroDocumento();
    }

    /**
     * Create an instance of {@link TotalEImpuestos }
     * 
     */
    public TotalEImpuestos createTotalEImpuestos() {
        return new TotalEImpuestos();
    }

    /**
     * Create an instance of {@link ArrayOfValidacionDoc }
     * 
     */
    public ArrayOfValidacionDoc createArrayOfValidacionDoc() {
        return new ArrayOfValidacionDoc();
    }

    /**
     * Create an instance of {@link ValidacionDoc }
     * 
     */
    public ValidacionDoc createValidacionDoc() {
        return new ValidacionDoc();
    }

    /**
     * Create an instance of {@link Evento }
     * 
     */
    public Evento createEvento() {
        return new Evento();
    }

    /**
     * Create an instance of {@link ArrayOfEvento }
     * 
     */
    public ArrayOfEvento createArrayOfEvento() {
        return new ArrayOfEvento();
    }

    /**
     * Create an instance of {@link ReferenciaDocumento }
     * 
     */
    public ReferenciaDocumento createReferenciaDocumento() {
        return new ReferenciaDocumento();
    }

    /**
     * Create an instance of {@link ArrayOfReferenciaDocumento }
     * 
     */
    public ArrayOfReferenciaDocumento createArrayOfReferenciaDocumento() {
        return new ArrayOfReferenciaDocumento();
    }

    /**
     * Create an instance of {@link ArrayOfKeyValueOfintstring.KeyValueOfintstring }
     * 
     */
    public ArrayOfKeyValueOfintstring.KeyValueOfintstring createArrayOfKeyValueOfintstringKeyValueOfintstring() {
        return new ArrayOfKeyValueOfintstring.KeyValueOfintstring();
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link UploadDocumentResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/UploadDocumentResponse", name = "UploadDocumentResponse")
    public JAXBElement<UploadDocumentResponse> createUploadDocumentResponse(UploadDocumentResponse value) {
        return new JAXBElement<UploadDocumentResponse>(_UploadDocumentResponse_QNAME, UploadDocumentResponse.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfEvento }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Evento", name = "ArrayOfEvento")
    public JAXBElement<ArrayOfEvento> createArrayOfEvento(ArrayOfEvento value) {
        return new JAXBElement<ArrayOfEvento>(_ArrayOfEvento_QNAME, ArrayOfEvento.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfNota }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Nota", name = "ArrayOfNota")
    public JAXBElement<ArrayOfNota> createArrayOfNota(ArrayOfNota value) {
        return new JAXBElement<ArrayOfNota>(_ArrayOfNota_QNAME, ArrayOfNota.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Duration }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "duration")
    public JAXBElement<Duration> createDuration(Duration value) {
        return new JAXBElement<Duration>(_Duration_QNAME, Duration.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfstring }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/Arrays", name = "ArrayOfstring")
    public JAXBElement<ArrayOfstring> createArrayOfstring(ArrayOfstring value) {
        return new JAXBElement<ArrayOfstring>(_ArrayOfstring_QNAME, ArrayOfstring.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Long }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "long")
    public JAXBElement<Long> createLong(Long value) {
        return new JAXBElement<Long>(_Long_QNAME, Long.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfValidacionDoc }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ValidacionDoc", name = "ArrayOfValidacionDoc")
    public JAXBElement<ArrayOfValidacionDoc> createArrayOfValidacionDoc(ArrayOfValidacionDoc value) {
        return new JAXBElement<ArrayOfValidacionDoc>(_ArrayOfValidacionDoc_QNAME, ArrayOfValidacionDoc.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link XMLGregorianCalendar }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "dateTime")
    public JAXBElement<XMLGregorianCalendar> createDateTime(XMLGregorianCalendar value) {
        return new JAXBElement<XMLGregorianCalendar>(_DateTime_QNAME, XMLGregorianCalendar.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link TotalEImpuestos }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/TotalEImpuestos", name = "TotalEImpuestos")
    public JAXBElement<TotalEImpuestos> createTotalEImpuestos(TotalEImpuestos value) {
        return new JAXBElement<TotalEImpuestos>(_TotalEImpuestos_QNAME, TotalEImpuestos.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "string")
    public JAXBElement<String> createString(String value) {
        return new JAXBElement<String>(_String_QNAME, String.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Long }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "unsignedInt")
    public JAXBElement<Long> createUnsignedInt(Long value) {
        return new JAXBElement<Long>(_UnsignedInt_QNAME, Long.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Integer }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "char")
    public JAXBElement<Integer> createChar(Integer value) {
        return new JAXBElement<Integer>(_Char_QNAME, Integer.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Short }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "short")
    public JAXBElement<Short> createShort(Short value) {
        return new JAXBElement<Short>(_Short_QNAME, Short.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link XmlParamsResponseTrackId }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/XmlParamsResponseTrackId", name = "XmlParamsResponseTrackId")
    public JAXBElement<XmlParamsResponseTrackId> createXmlParamsResponseTrackId(XmlParamsResponseTrackId value) {
        return new JAXBElement<XmlParamsResponseTrackId>(_XmlParamsResponseTrackId_QNAME, XmlParamsResponseTrackId.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link DocumentInfoResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/DocumentInfoResponse", name = "DocumentInfoResponse")
    public JAXBElement<DocumentInfoResponse> createDocumentInfoResponse(DocumentInfoResponse value) {
        return new JAXBElement<DocumentInfoResponse>(_DocumentInfoResponse_QNAME, DocumentInfoResponse.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Nota }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Nota", name = "Nota")
    public JAXBElement<Nota> createNota(Nota value) {
        return new JAXBElement<Nota>(_Nota_QNAME, Nota.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Boolean }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "boolean")
    public JAXBElement<Boolean> createBoolean(Boolean value) {
        return new JAXBElement<Boolean>(_Boolean_QNAME, Boolean.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link EventResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/EventResponse", name = "EventResponse")
    public JAXBElement<EventResponse> createEventResponse(EventResponse value) {
        return new JAXBElement<EventResponse>(_EventResponse_QNAME, EventResponse.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link NumeroDocumento }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumeroDocumento", name = "NumeroDocumento")
    public JAXBElement<NumeroDocumento> createNumeroDocumento(NumeroDocumento value) {
        return new JAXBElement<NumeroDocumento>(_NumeroDocumento_QNAME, NumeroDocumento.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Integer }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "int")
    public JAXBElement<Integer> createInt(Integer value) {
        return new JAXBElement<Integer>(_Int_QNAME, Integer.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfKeyValueOfintstring }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/Arrays", name = "ArrayOfKeyValueOfintstring")
    public JAXBElement<ArrayOfKeyValueOfintstring> createArrayOfKeyValueOfintstring(ArrayOfKeyValueOfintstring value) {
        return new JAXBElement<ArrayOfKeyValueOfintstring>(_ArrayOfKeyValueOfintstring_QNAME, ArrayOfKeyValueOfintstring.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfXmlParamsResponseTrackId }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/XmlParamsResponseTrackId", name = "ArrayOfXmlParamsResponseTrackId")
    public JAXBElement<ArrayOfXmlParamsResponseTrackId> createArrayOfXmlParamsResponseTrackId(ArrayOfXmlParamsResponseTrackId value) {
        return new JAXBElement<ArrayOfXmlParamsResponseTrackId>(_ArrayOfXmlParamsResponseTrackId_QNAME, ArrayOfXmlParamsResponseTrackId.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link QName }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "QName")
    public JAXBElement<QName> createQName(QName value) {
        return new JAXBElement<QName>(_QName_QNAME, QName.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link BigInteger }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "unsignedLong")
    public JAXBElement<BigInteger> createUnsignedLong(BigInteger value) {
        return new JAXBElement<BigInteger>(_UnsignedLong_QNAME, BigInteger.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Short }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "unsignedByte")
    public JAXBElement<Short> createUnsignedByte(Short value) {
        return new JAXBElement<Short>(_UnsignedByte_QNAME, Short.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Integer }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "unsignedShort")
    public JAXBElement<Integer> createUnsignedShort(Integer value) {
        return new JAXBElement<Integer>(_UnsignedShort_QNAME, Integer.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfDianResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/DianResponse", name = "ArrayOfDianResponse")
    public JAXBElement<ArrayOfDianResponse> createArrayOfDianResponse(ArrayOfDianResponse value) {
        return new JAXBElement<ArrayOfDianResponse>(_ArrayOfDianResponse_QNAME, ArrayOfDianResponse.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link NumberRangeResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumberRangeResponse", name = "NumberRangeResponse")
    public JAXBElement<NumberRangeResponse> createNumberRangeResponse(NumberRangeResponse value) {
        return new JAXBElement<NumberRangeResponse>(_NumberRangeResponse_QNAME, NumberRangeResponse.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link AdquirienteResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Gosocket.Dian.Services.Utils.Common", name = "AdquirienteResponse")
    public JAXBElement<AdquirienteResponse> createAdquirienteResponse(AdquirienteResponse value) {
        return new JAXBElement<AdquirienteResponse>(_AdquirienteResponse_QNAME, AdquirienteResponse.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Documento }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "Documento")
    public JAXBElement<Documento> createDocumento(Documento value) {
        return new JAXBElement<Documento>(_Documento_QNAME, Documento.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfReferenciaDocumento }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", name = "ArrayOfReferenciaDocumento")
    public JAXBElement<ArrayOfReferenciaDocumento> createArrayOfReferenciaDocumento(ArrayOfReferenciaDocumento value) {
        return new JAXBElement<ArrayOfReferenciaDocumento>(_ArrayOfReferenciaDocumento_QNAME, ArrayOfReferenciaDocumento.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfNumberRangeResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumberRangeResponse", name = "ArrayOfNumberRangeResponse")
    public JAXBElement<ArrayOfNumberRangeResponse> createArrayOfNumberRangeResponse(ArrayOfNumberRangeResponse value) {
        return new JAXBElement<ArrayOfNumberRangeResponse>(_ArrayOfNumberRangeResponse_QNAME, ArrayOfNumberRangeResponse.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link LegitimoTenedor }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/LegitimoTenedor", name = "LegitimoTenedor")
    public JAXBElement<LegitimoTenedor> createLegitimoTenedor(LegitimoTenedor value) {
        return new JAXBElement<LegitimoTenedor>(_LegitimoTenedor_QNAME, LegitimoTenedor.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Float }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "float")
    public JAXBElement<Float> createFloat(Float value) {
        return new JAXBElement<Float>(_Float_QNAME, Float.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ValidacionDoc }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ValidacionDoc", name = "ValidacionDoc")
    public JAXBElement<ValidacionDoc> createValidacionDoc(ValidacionDoc value) {
        return new JAXBElement<ValidacionDoc>(_ValidacionDoc_QNAME, ValidacionDoc.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ReferenciaDocumento }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", name = "ReferenciaDocumento")
    public JAXBElement<ReferenciaDocumento> createReferenciaDocumento(ReferenciaDocumento value) {
        return new JAXBElement<ReferenciaDocumento>(_ReferenciaDocumento_QNAME, ReferenciaDocumento.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link DianResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/DianResponse", name = "DianResponse")
    public JAXBElement<DianResponse> createDianResponse(DianResponse value) {
        return new JAXBElement<DianResponse>(_DianResponse_QNAME, DianResponse.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Object }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "anyType")
    public JAXBElement<Object> createAnyType(Object value) {
        return new JAXBElement<Object>(_AnyType_QNAME, Object.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link NumberRangeResponseList }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumberRangeResponseList", name = "NumberRangeResponseList")
    public JAXBElement<NumberRangeResponseList> createNumberRangeResponseList(NumberRangeResponseList value) {
        return new JAXBElement<NumberRangeResponseList>(_NumberRangeResponseList_QNAME, NumberRangeResponseList.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ConceptoCorreccion }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ConceptoCorreccion", name = "ConceptoCorreccion")
    public JAXBElement<ConceptoCorreccion> createConceptoCorreccion(ConceptoCorreccion value) {
        return new JAXBElement<ConceptoCorreccion>(_ConceptoCorreccion_QNAME, ConceptoCorreccion.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "guid")
    public JAXBElement<String> createGuid(String value) {
        return new JAXBElement<String>(_Guid_QNAME, String.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link BigDecimal }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "decimal")
    public JAXBElement<BigDecimal> createDecimal(BigDecimal value) {
        return new JAXBElement<BigDecimal>(_Decimal_QNAME, BigDecimal.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfDocumento }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "ArrayOfDocumento")
    public JAXBElement<ArrayOfDocumento> createArrayOfDocumento(ArrayOfDocumento value) {
        return new JAXBElement<ArrayOfDocumento>(_ArrayOfDocumento_QNAME, ArrayOfDocumento.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Entidad }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Entidad", name = "Entidad")
    public JAXBElement<Entidad> createEntidad(Entidad value) {
        return new JAXBElement<Entidad>(_Entidad_QNAME, Entidad.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link byte[]}{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "base64Binary")
    public JAXBElement<byte[]> createBase64Binary(byte[] value) {
        return new JAXBElement<byte[]>(_Base64Binary_QNAME, byte[].class, null, ((byte[]) value));
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Evento }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Evento", name = "Evento")
    public JAXBElement<Evento> createEvento(Evento value) {
        return new JAXBElement<Evento>(_Evento_QNAME, Evento.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "anyURI")
    public JAXBElement<String> createAnyURI(String value) {
        return new JAXBElement<String>(_AnyURI_QNAME, String.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ExchangeEmailResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ExchangeEmailResponse", name = "ExchangeEmailResponse")
    public JAXBElement<ExchangeEmailResponse> createExchangeEmailResponse(ExchangeEmailResponse value) {
        return new JAXBElement<ExchangeEmailResponse>(_ExchangeEmailResponse_QNAME, ExchangeEmailResponse.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Byte }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "byte")
    public JAXBElement<Byte> createByte(Byte value) {
        return new JAXBElement<Byte>(_Byte_QNAME, Byte.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Double }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.microsoft.com/2003/10/Serialization/", name = "double")
    public JAXBElement<Double> createDouble(Double value) {
        return new JAXBElement<Double>(_Double_QNAME, Double.class, null, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ExchangeEmailResponse", name = "StatusCode", scope = ExchangeEmailResponse.class)
    public JAXBElement<String> createExchangeEmailResponseStatusCode(String value) {
        return new JAXBElement<String>(_ExchangeEmailResponseStatusCode_QNAME, String.class, ExchangeEmailResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ExchangeEmailResponse", name = "CsvBase64Bytes", scope = ExchangeEmailResponse.class)
    public JAXBElement<String> createExchangeEmailResponseCsvBase64Bytes(String value) {
        return new JAXBElement<String>(_ExchangeEmailResponseCsvBase64Bytes_QNAME, String.class, ExchangeEmailResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ExchangeEmailResponse", name = "Message", scope = ExchangeEmailResponse.class)
    public JAXBElement<String> createExchangeEmailResponseMessage(String value) {
        return new JAXBElement<String>(_ExchangeEmailResponseMessage_QNAME, String.class, ExchangeEmailResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumberRangeResponseList", name = "OperationCode", scope = NumberRangeResponseList.class)
    public JAXBElement<String> createNumberRangeResponseListOperationCode(String value) {
        return new JAXBElement<String>(_NumberRangeResponseListOperationCode_QNAME, String.class, NumberRangeResponseList.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfNumberRangeResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumberRangeResponseList", name = "ResponseList", scope = NumberRangeResponseList.class)
    public JAXBElement<ArrayOfNumberRangeResponse> createNumberRangeResponseListResponseList(ArrayOfNumberRangeResponse value) {
        return new JAXBElement<ArrayOfNumberRangeResponse>(_NumberRangeResponseListResponseList_QNAME, ArrayOfNumberRangeResponse.class, NumberRangeResponseList.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumberRangeResponseList", name = "OperationDescription", scope = NumberRangeResponseList.class)
    public JAXBElement<String> createNumberRangeResponseListOperationDescription(String value) {
        return new JAXBElement<String>(_NumberRangeResponseListOperationDescription_QNAME, String.class, NumberRangeResponseList.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "trackId", scope = GetReferenceNotes.class)
    public JAXBElement<String> createGetReferenceNotesTrackId(String value) {
        return new JAXBElement<String>(_GetReferenceNotesTrackId_QNAME, String.class, GetReferenceNotes.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link NumberRangeResponseList }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "GetNumberingRangeResult", scope = GetNumberingRangeResponse.class)
    public JAXBElement<NumberRangeResponseList> createGetNumberingRangeResponseGetNumberingRangeResult(NumberRangeResponseList value) {
        return new JAXBElement<NumberRangeResponseList>(_GetNumberingRangeResponseGetNumberingRangeResult_QNAME, NumberRangeResponseList.class, GetNumberingRangeResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link AdquirienteResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "GetAcquirerResult", scope = GetAcquirerResponse.class)
    public JAXBElement<AdquirienteResponse> createGetAcquirerResponseGetAcquirerResult(AdquirienteResponse value) {
        return new JAXBElement<AdquirienteResponse>(_GetAcquirerResponseGetAcquirerResult_QNAME, AdquirienteResponse.class, GetAcquirerResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumeroDocumento", name = "FechaFirma", scope = NumeroDocumento.class)
    public JAXBElement<String> createNumeroDocumentoFechaFirma(String value) {
        return new JAXBElement<String>(_NumeroDocumentoFechaFirma_QNAME, String.class, NumeroDocumento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumeroDocumento", name = "Folio", scope = NumeroDocumento.class)
    public JAXBElement<String> createNumeroDocumentoFolio(String value) {
        return new JAXBElement<String>(_NumeroDocumentoFolio_QNAME, String.class, NumeroDocumento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumeroDocumento", name = "FechaEmision", scope = NumeroDocumento.class)
    public JAXBElement<String> createNumeroDocumentoFechaEmision(String value) {
        return new JAXBElement<String>(_NumeroDocumentoFechaEmision_QNAME, String.class, NumeroDocumento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumeroDocumento", name = "Serie", scope = NumeroDocumento.class)
    public JAXBElement<String> createNumeroDocumentoSerie(String value) {
        return new JAXBElement<String>(_NumeroDocumentoSerie_QNAME, String.class, NumeroDocumento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "fileName", scope = SendBillAttachmentAsync.class)
    public JAXBElement<String> createSendBillAttachmentAsyncFileName(String value) {
        return new JAXBElement<String>(_SendBillAttachmentAsyncFileName_QNAME, String.class, SendBillAttachmentAsync.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link byte[]}{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "contentFile", scope = SendBillAttachmentAsync.class)
    public JAXBElement<byte[]> createSendBillAttachmentAsyncContentFile(byte[] value) {
        return new JAXBElement<byte[]>(_SendBillAttachmentAsyncContentFile_QNAME, byte[].class, SendBillAttachmentAsync.class, ((byte[]) value));
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfDianResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "GetStatusZipResult", scope = GetStatusZipResponse.class)
    public JAXBElement<ArrayOfDianResponse> createGetStatusZipResponseGetStatusZipResult(ArrayOfDianResponse value) {
        return new JAXBElement<ArrayOfDianResponse>(_GetStatusZipResponseGetStatusZipResult_QNAME, ArrayOfDianResponse.class, GetStatusZipResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Evento", name = "Descripcion", scope = Evento.class)
    public JAXBElement<String> createEventoDescripcion(String value) {
        return new JAXBElement<String>(_EventoDescripcion_QNAME, String.class, Evento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Entidad }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Evento", name = "Emisor", scope = Evento.class)
    public JAXBElement<Entidad> createEventoEmisor(Entidad value) {
        return new JAXBElement<Entidad>(_EventoEmisor_QNAME, Entidad.class, Evento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Evento", name = "UUID", scope = Evento.class)
    public JAXBElement<String> createEventoUUID(String value) {
        return new JAXBElement<String>(_EventoUUID_QNAME, String.class, Evento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfValidacionDoc }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Evento", name = "ValidacionesDoc", scope = Evento.class)
    public JAXBElement<ArrayOfValidacionDoc> createEventoValidacionesDoc(ArrayOfValidacionDoc value) {
        return new JAXBElement<ArrayOfValidacionDoc>(_EventoValidacionesDoc_QNAME, ArrayOfValidacionDoc.class, Evento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link NumeroDocumento }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Evento", name = "NumeroDocumento", scope = Evento.class)
    public JAXBElement<NumeroDocumento> createEventoNumeroDocumento(NumeroDocumento value) {
        return new JAXBElement<NumeroDocumento>(_EventoNumeroDocumento_QNAME, NumeroDocumento.class, Evento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfReferenciaDocumento }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Evento", name = "ReferenciasDocumento", scope = Evento.class)
    public JAXBElement<ArrayOfReferenciaDocumento> createEventoReferenciasDocumento(ArrayOfReferenciaDocumento value) {
        return new JAXBElement<ArrayOfReferenciaDocumento>(_EventoReferenciasDocumento_QNAME, ArrayOfReferenciaDocumento.class, Evento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Entidad }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Evento", name = "Receptor", scope = Evento.class)
    public JAXBElement<Entidad> createEventoReceptor(Entidad value) {
        return new JAXBElement<Entidad>(_EventoReceptor_QNAME, Entidad.class, Evento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Evento", name = "Codigo", scope = Evento.class)
    public JAXBElement<String> createEventoCodigo(String value) {
        return new JAXBElement<String>(_EventoCodigo_QNAME, String.class, Evento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ValidacionDoc", name = "MensajeError", scope = ValidacionDoc.class)
    public JAXBElement<String> createValidacionDocMensajeError(String value) {
        return new JAXBElement<String>(_ValidacionDocMensajeError_QNAME, String.class, ValidacionDoc.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ValidacionDoc", name = "Nombre", scope = ValidacionDoc.class)
    public JAXBElement<String> createValidacionDocNombre(String value) {
        return new JAXBElement<String>(_ValidacionDocNombre_QNAME, String.class, ValidacionDoc.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ValidacionDoc", name = "Status", scope = ValidacionDoc.class)
    public JAXBElement<String> createValidacionDocStatus(String value) {
        return new JAXBElement<String>(_ValidacionDocStatus_QNAME, String.class, ValidacionDoc.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ConceptoCorreccion", name = "Nombre", scope = ConceptoCorreccion.class)
    public JAXBElement<String> createConceptoCorreccionNombre(String value) {
        return new JAXBElement<String>(_ConceptoCorreccionNombre_QNAME, String.class, ConceptoCorreccion.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ConceptoCorreccion", name = "Codigo", scope = ConceptoCorreccion.class)
    public JAXBElement<String> createConceptoCorreccionCodigo(String value) {
        return new JAXBElement<String>(_ConceptoCorreccionCodigo_QNAME, String.class, ConceptoCorreccion.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ConceptoCorreccion", name = "Descripcion", scope = ConceptoCorreccion.class)
    public JAXBElement<String> createConceptoCorreccionDescripcion(String value) {
        return new JAXBElement<String>(_ConceptoCorreccionDescripcion_QNAME, String.class, ConceptoCorreccion.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumberRangeResponse", name = "TechnicalKey", scope = NumberRangeResponse.class)
    public JAXBElement<String> createNumberRangeResponseTechnicalKey(String value) {
        return new JAXBElement<String>(_NumberRangeResponseTechnicalKey_QNAME, String.class, NumberRangeResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumberRangeResponse", name = "ValidDateTo", scope = NumberRangeResponse.class)
    public JAXBElement<String> createNumberRangeResponseValidDateTo(String value) {
        return new JAXBElement<String>(_NumberRangeResponseValidDateTo_QNAME, String.class, NumberRangeResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumberRangeResponse", name = "ResolutionDate", scope = NumberRangeResponse.class)
    public JAXBElement<String> createNumberRangeResponseResolutionDate(String value) {
        return new JAXBElement<String>(_NumberRangeResponseResolutionDate_QNAME, String.class, NumberRangeResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumberRangeResponse", name = "ValidDateFrom", scope = NumberRangeResponse.class)
    public JAXBElement<String> createNumberRangeResponseValidDateFrom(String value) {
        return new JAXBElement<String>(_NumberRangeResponseValidDateFrom_QNAME, String.class, NumberRangeResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumberRangeResponse", name = "ResolutionNumber", scope = NumberRangeResponse.class)
    public JAXBElement<String> createNumberRangeResponseResolutionNumber(String value) {
        return new JAXBElement<String>(_NumberRangeResponseResolutionNumber_QNAME, String.class, NumberRangeResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/NumberRangeResponse", name = "Prefix", scope = NumberRangeResponse.class)
    public JAXBElement<String> createNumberRangeResponsePrefix(String value) {
        return new JAXBElement<String>(_NumberRangeResponsePrefix_QNAME, String.class, NumberRangeResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link DianResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "SendEventUpdateStatusResult", scope = SendEventUpdateStatusResponse.class)
    public JAXBElement<DianResponse> createSendEventUpdateStatusResponseSendEventUpdateStatusResult(DianResponse value) {
        return new JAXBElement<DianResponse>(_SendEventUpdateStatusResponseSendEventUpdateStatusResult_QNAME, DianResponse.class, SendEventUpdateStatusResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "fileName", scope = SendBillAsync.class)
    public JAXBElement<String> createSendBillAsyncFileName(String value) {
        return new JAXBElement<String>(_SendBillAttachmentAsyncFileName_QNAME, String.class, SendBillAsync.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link byte[]}{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "contentFile", scope = SendBillAsync.class)
    public JAXBElement<byte[]> createSendBillAsyncContentFile(byte[] value) {
        return new JAXBElement<byte[]>(_SendBillAttachmentAsyncContentFile_QNAME, byte[].class, SendBillAsync.class, ((byte[]) value));
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link UploadDocumentResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "SendBillAsyncResult", scope = SendBillAsyncResponse.class)
    public JAXBElement<UploadDocumentResponse> createSendBillAsyncResponseSendBillAsyncResult(UploadDocumentResponse value) {
        return new JAXBElement<UploadDocumentResponse>(_SendBillAsyncResponseSendBillAsyncResult_QNAME, UploadDocumentResponse.class, SendBillAsyncResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/EventResponse", name = "Code", scope = EventResponse.class)
    public JAXBElement<String> createEventResponseCode(String value) {
        return new JAXBElement<String>(_EventResponseCode_QNAME, String.class, EventResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/EventResponse", name = "Message", scope = EventResponse.class)
    public JAXBElement<String> createEventResponseMessage(String value) {
        return new JAXBElement<String>(_EventResponseMessage_QNAME, String.class, EventResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/EventResponse", name = "ValidationDate", scope = EventResponse.class)
    public JAXBElement<String> createEventResponseValidationDate(String value) {
        return new JAXBElement<String>(_EventResponseValidationDate_QNAME, String.class, EventResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/EventResponse", name = "XmlBytesBase64", scope = EventResponse.class)
    public JAXBElement<String> createEventResponseXmlBytesBase64(String value) {
        return new JAXBElement<String>(_EventResponseXmlBytesBase64_QNAME, String.class, EventResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link byte[]}{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/DianResponse", name = "XmlBytes", scope = DianResponse.class)
    public JAXBElement<byte[]> createDianResponseXmlBytes(byte[] value) {
        return new JAXBElement<byte[]>(_DianResponseXmlBytes_QNAME, byte[].class, DianResponse.class, ((byte[]) value));
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/DianResponse", name = "StatusDescription", scope = DianResponse.class)
    public JAXBElement<String> createDianResponseStatusDescription(String value) {
        return new JAXBElement<String>(_DianResponseStatusDescription_QNAME, String.class, DianResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link byte[]}{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/DianResponse", name = "XmlBase64Bytes", scope = DianResponse.class)
    public JAXBElement<byte[]> createDianResponseXmlBase64Bytes(byte[] value) {
        return new JAXBElement<byte[]>(_DianResponseXmlBase64Bytes_QNAME, byte[].class, DianResponse.class, ((byte[]) value));
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/DianResponse", name = "XmlDocumentKey", scope = DianResponse.class)
    public JAXBElement<String> createDianResponseXmlDocumentKey(String value) {
        return new JAXBElement<String>(_DianResponseXmlDocumentKey_QNAME, String.class, DianResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/DianResponse", name = "StatusMessage", scope = DianResponse.class)
    public JAXBElement<String> createDianResponseStatusMessage(String value) {
        return new JAXBElement<String>(_DianResponseStatusMessage_QNAME, String.class, DianResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/DianResponse", name = "XmlFileName", scope = DianResponse.class)
    public JAXBElement<String> createDianResponseXmlFileName(String value) {
        return new JAXBElement<String>(_DianResponseXmlFileName_QNAME, String.class, DianResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfstring }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/DianResponse", name = "ErrorMessage", scope = DianResponse.class)
    public JAXBElement<ArrayOfstring> createDianResponseErrorMessage(ArrayOfstring value) {
        return new JAXBElement<ArrayOfstring>(_DianResponseErrorMessage_QNAME, ArrayOfstring.class, DianResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/DianResponse", name = "StatusCode", scope = DianResponse.class)
    public JAXBElement<String> createDianResponseStatusCode(String value) {
        return new JAXBElement<String>(_DianResponseStatusCode_QNAME, String.class, DianResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "uuid", scope = GetDocumentInfo.class)
    public JAXBElement<String> createGetDocumentInfoUuid(String value) {
        return new JAXBElement<String>(_GetDocumentInfoUuid_QNAME, String.class, GetDocumentInfo.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "fileName", scope = SendTestSetAsync.class)
    public JAXBElement<String> createSendTestSetAsyncFileName(String value) {
        return new JAXBElement<String>(_SendBillAttachmentAsyncFileName_QNAME, String.class, SendTestSetAsync.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link byte[]}{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "contentFile", scope = SendTestSetAsync.class)
    public JAXBElement<byte[]> createSendTestSetAsyncContentFile(byte[] value) {
        return new JAXBElement<byte[]>(_SendBillAttachmentAsyncContentFile_QNAME, byte[].class, SendTestSetAsync.class, ((byte[]) value));
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "testSetId", scope = SendTestSetAsync.class)
    public JAXBElement<String> createSendTestSetAsyncTestSetId(String value) {
        return new JAXBElement<String>(_SendTestSetAsyncTestSetId_QNAME, String.class, SendTestSetAsync.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link byte[]}{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "contentFile", scope = SendEventUpdateStatus.class)
    public JAXBElement<byte[]> createSendEventUpdateStatusContentFile(byte[] value) {
        return new JAXBElement<byte[]>(_SendBillAttachmentAsyncContentFile_QNAME, byte[].class, SendEventUpdateStatus.class, ((byte[]) value));
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link byte[]}{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "contentFile", scope = SendNominaSync.class)
    public JAXBElement<byte[]> createSendNominaSyncContentFile(byte[] value) {
        return new JAXBElement<byte[]>(_SendBillAttachmentAsyncContentFile_QNAME, byte[].class, SendNominaSync.class, ((byte[]) value));
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link DianResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "SendBillSyncResult", scope = SendBillSyncResponse.class)
    public JAXBElement<DianResponse> createSendBillSyncResponseSendBillSyncResult(DianResponse value) {
        return new JAXBElement<DianResponse>(_SendBillSyncResponseSendBillSyncResult_QNAME, DianResponse.class, SendBillSyncResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link LegitimoTenedor }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Nota", name = "LegitimoTenedor", scope = Nota.class)
    public JAXBElement<LegitimoTenedor> createNotaLegitimoTenedor(LegitimoTenedor value) {
        return new JAXBElement<LegitimoTenedor>(_NotaLegitimoTenedor_QNAME, LegitimoTenedor.class, Nota.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Nota", name = "NombreTipoDocumento", scope = Nota.class)
    public JAXBElement<String> createNotaNombreTipoDocumento(String value) {
        return new JAXBElement<String>(_NotaNombreTipoDocumento_QNAME, String.class, Nota.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Nota", name = "UUID", scope = Nota.class)
    public JAXBElement<String> createNotaUUID(String value) {
        return new JAXBElement<String>(_NotaUUID_QNAME, String.class, Nota.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfValidacionDoc }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Nota", name = "ValidacionesDoc", scope = Nota.class)
    public JAXBElement<ArrayOfValidacionDoc> createNotaValidacionesDoc(ArrayOfValidacionDoc value) {
        return new JAXBElement<ArrayOfValidacionDoc>(_NotaValidacionesDoc_QNAME, ArrayOfValidacionDoc.class, Nota.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link NumeroDocumento }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Nota", name = "NumeroDocumento", scope = Nota.class)
    public JAXBElement<NumeroDocumento> createNotaNumeroDocumento(NumeroDocumento value) {
        return new JAXBElement<NumeroDocumento>(_NotaNumeroDocumento_QNAME, NumeroDocumento.class, Nota.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link TotalEImpuestos }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Nota", name = "TotalEImpuestos", scope = Nota.class)
    public JAXBElement<TotalEImpuestos> createNotaTotalEImpuestos(TotalEImpuestos value) {
        return new JAXBElement<TotalEImpuestos>(_NotaTotalEImpuestos_QNAME, TotalEImpuestos.class, Nota.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Entidad }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Nota", name = "Emisor", scope = Nota.class)
    public JAXBElement<Entidad> createNotaEmisor(Entidad value) {
        return new JAXBElement<Entidad>(_NotaEmisor_QNAME, Entidad.class, Nota.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Entidad }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Nota", name = "Receptor", scope = Nota.class)
    public JAXBElement<Entidad> createNotaReceptor(Entidad value) {
        return new JAXBElement<Entidad>(_NotaReceptor_QNAME, Entidad.class, Nota.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ConceptoCorreccion }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Nota", name = "ConceptoCorreccion", scope = Nota.class)
    public JAXBElement<ConceptoCorreccion> createNotaConceptoCorreccion(ConceptoCorreccion value) {
        return new JAXBElement<ConceptoCorreccion>(_NotaConceptoCorreccion_QNAME, ConceptoCorreccion.class, Nota.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/DocumentInfoResponse", name = "CompressedDocumentInfo", scope = DocumentInfoResponse.class)
    public JAXBElement<String> createDocumentInfoResponseCompressedDocumentInfo(String value) {
        return new JAXBElement<String>(_DocumentInfoResponseCompressedDocumentInfo_QNAME, String.class, DocumentInfoResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/DocumentInfoResponse", name = "StatusDescription", scope = DocumentInfoResponse.class)
    public JAXBElement<String> createDocumentInfoResponseStatusDescription(String value) {
        return new JAXBElement<String>(_DocumentInfoResponseStatusDescription_QNAME, String.class, DocumentInfoResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/DocumentInfoResponse", name = "StatusCode", scope = DocumentInfoResponse.class)
    public JAXBElement<String> createDocumentInfoResponseStatusCode(String value) {
        return new JAXBElement<String>(_DocumentInfoResponseStatusCode_QNAME, String.class, DocumentInfoResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfDocumento }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/DocumentInfoResponse", name = "DocumentInfo", scope = DocumentInfoResponse.class)
    public JAXBElement<ArrayOfDocumento> createDocumentInfoResponseDocumentInfo(ArrayOfDocumento value) {
        return new JAXBElement<ArrayOfDocumento>(_DocumentInfoResponseDocumentInfo_QNAME, ArrayOfDocumento.class, DocumentInfoResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link UploadDocumentResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "SendTestSetAsyncResult", scope = SendTestSetAsyncResponse.class)
    public JAXBElement<UploadDocumentResponse> createSendTestSetAsyncResponseSendTestSetAsyncResult(UploadDocumentResponse value) {
        return new JAXBElement<UploadDocumentResponse>(_SendTestSetAsyncResponseSendTestSetAsyncResult_QNAME, UploadDocumentResponse.class, SendTestSetAsyncResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "trackId", scope = GetStatusZip.class)
    public JAXBElement<String> createGetStatusZipTrackId(String value) {
        return new JAXBElement<String>(_GetReferenceNotesTrackId_QNAME, String.class, GetStatusZip.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "accountCode", scope = GetNumberingRange.class)
    public JAXBElement<String> createGetNumberingRangeAccountCode(String value) {
        return new JAXBElement<String>(_GetNumberingRangeAccountCode_QNAME, String.class, GetNumberingRange.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "accountCodeT", scope = GetNumberingRange.class)
    public JAXBElement<String> createGetNumberingRangeAccountCodeT(String value) {
        return new JAXBElement<String>(_GetNumberingRangeAccountCodeT_QNAME, String.class, GetNumberingRange.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "softwareCode", scope = GetNumberingRange.class)
    public JAXBElement<String> createGetNumberingRangeSoftwareCode(String value) {
        return new JAXBElement<String>(_GetNumberingRangeSoftwareCode_QNAME, String.class, GetNumberingRange.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/LegitimoTenedor", name = "FechaInscripcionComoTituloValor", scope = LegitimoTenedor.class)
    public JAXBElement<String> createLegitimoTenedorFechaInscripcionComoTituloValor(String value) {
        return new JAXBElement<String>(_LegitimoTenedorFechaInscripcionComoTituloValor_QNAME, String.class, LegitimoTenedor.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/LegitimoTenedor", name = "Nombre", scope = LegitimoTenedor.class)
    public JAXBElement<String> createLegitimoTenedorNombre(String value) {
        return new JAXBElement<String>(_LegitimoTenedorNombre_QNAME, String.class, LegitimoTenedor.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ExchangeEmailResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "GetExchangeEmailsResult", scope = GetExchangeEmailsResponse.class)
    public JAXBElement<ExchangeEmailResponse> createGetExchangeEmailsResponseGetExchangeEmailsResult(ExchangeEmailResponse value) {
        return new JAXBElement<ExchangeEmailResponse>(_GetExchangeEmailsResponseGetExchangeEmailsResult_QNAME, ExchangeEmailResponse.class, GetExchangeEmailsResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "identificationType", scope = GetAcquirer.class)
    public JAXBElement<String> createGetAcquirerIdentificationType(String value) {
        return new JAXBElement<String>(_GetAcquirerIdentificationType_QNAME, String.class, GetAcquirer.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "identificationNumber", scope = GetAcquirer.class)
    public JAXBElement<String> createGetAcquirerIdentificationNumber(String value) {
        return new JAXBElement<String>(_GetAcquirerIdentificationNumber_QNAME, String.class, GetAcquirer.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/XmlParamsResponseTrackId", name = "DocumentKey", scope = XmlParamsResponseTrackId.class)
    public JAXBElement<String> createXmlParamsResponseTrackIdDocumentKey(String value) {
        return new JAXBElement<String>(_XmlParamsResponseTrackIdDocumentKey_QNAME, String.class, XmlParamsResponseTrackId.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/XmlParamsResponseTrackId", name = "SenderCode", scope = XmlParamsResponseTrackId.class)
    public JAXBElement<String> createXmlParamsResponseTrackIdSenderCode(String value) {
        return new JAXBElement<String>(_XmlParamsResponseTrackIdSenderCode_QNAME, String.class, XmlParamsResponseTrackId.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/XmlParamsResponseTrackId", name = "XmlFileName", scope = XmlParamsResponseTrackId.class)
    public JAXBElement<String> createXmlParamsResponseTrackIdXmlFileName(String value) {
        return new JAXBElement<String>(_XmlParamsResponseTrackIdXmlFileName_QNAME, String.class, XmlParamsResponseTrackId.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/XmlParamsResponseTrackId", name = "ProcessedMessage", scope = XmlParamsResponseTrackId.class)
    public JAXBElement<String> createXmlParamsResponseTrackIdProcessedMessage(String value) {
        return new JAXBElement<String>(_XmlParamsResponseTrackIdProcessedMessage_QNAME, String.class, XmlParamsResponseTrackId.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link DianResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "GetReferenceNotesResult", scope = GetReferenceNotesResponse.class)
    public JAXBElement<DianResponse> createGetReferenceNotesResponseGetReferenceNotesResult(DianResponse value) {
        return new JAXBElement<DianResponse>(_GetReferenceNotesResponseGetReferenceNotesResult_QNAME, DianResponse.class, GetReferenceNotesResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Entidad }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", name = "Receptor", scope = ReferenciaDocumento.class)
    public JAXBElement<Entidad> createReferenciaDocumentoReceptor(Entidad value) {
        return new JAXBElement<Entidad>(_ReferenciaDocumentoReceptor_QNAME, Entidad.class, ReferenciaDocumento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", name = "Fecha", scope = ReferenciaDocumento.class)
    public JAXBElement<String> createReferenciaDocumentoFecha(String value) {
        return new JAXBElement<String>(_ReferenciaDocumentoFecha_QNAME, String.class, ReferenciaDocumento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", name = "DocumentTypeId", scope = ReferenciaDocumento.class)
    public JAXBElement<String> createReferenciaDocumentoDocumentTypeId(String value) {
        return new JAXBElement<String>(_ReferenciaDocumentoDocumentTypeId_QNAME, String.class, ReferenciaDocumento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", name = "DocumentTypeName", scope = ReferenciaDocumento.class)
    public JAXBElement<String> createReferenciaDocumentoDocumentTypeName(String value) {
        return new JAXBElement<String>(_ReferenciaDocumentoDocumentTypeName_QNAME, String.class, ReferenciaDocumento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", name = "UUID", scope = ReferenciaDocumento.class)
    public JAXBElement<String> createReferenciaDocumentoUUID(String value) {
        return new JAXBElement<String>(_ReferenciaDocumentoUUID_QNAME, String.class, ReferenciaDocumento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", name = "Descripcion", scope = ReferenciaDocumento.class)
    public JAXBElement<String> createReferenciaDocumentoDescripcion(String value) {
        return new JAXBElement<String>(_ReferenciaDocumentoDescripcion_QNAME, String.class, ReferenciaDocumento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Entidad }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/ReferenciaDocumento", name = "Emisor", scope = ReferenciaDocumento.class)
    public JAXBElement<Entidad> createReferenciaDocumentoEmisor(Entidad value) {
        return new JAXBElement<Entidad>(_ReferenciaDocumentoEmisor_QNAME, Entidad.class, ReferenciaDocumento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfXmlParamsResponseTrackId }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/UploadDocumentResponse", name = "ErrorMessageList", scope = UploadDocumentResponse.class)
    public JAXBElement<ArrayOfXmlParamsResponseTrackId> createUploadDocumentResponseErrorMessageList(ArrayOfXmlParamsResponseTrackId value) {
        return new JAXBElement<ArrayOfXmlParamsResponseTrackId>(_UploadDocumentResponseErrorMessageList_QNAME, ArrayOfXmlParamsResponseTrackId.class, UploadDocumentResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/UploadDocumentResponse", name = "ZipKey", scope = UploadDocumentResponse.class)
    public JAXBElement<String> createUploadDocumentResponseZipKey(String value) {
        return new JAXBElement<String>(_UploadDocumentResponseZipKey_QNAME, String.class, UploadDocumentResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "trackId", scope = GetStatusEvent.class)
    public JAXBElement<String> createGetStatusEventTrackId(String value) {
        return new JAXBElement<String>(_GetReferenceNotesTrackId_QNAME, String.class, GetStatusEvent.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link EventResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "GetXmlByDocumentKeyResult", scope = GetXmlByDocumentKeyResponse.class)
    public JAXBElement<EventResponse> createGetXmlByDocumentKeyResponseGetXmlByDocumentKeyResult(EventResponse value) {
        return new JAXBElement<EventResponse>(_GetXmlByDocumentKeyResponseGetXmlByDocumentKeyResult_QNAME, EventResponse.class, GetXmlByDocumentKeyResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "fileName", scope = SendBillSync.class)
    public JAXBElement<String> createSendBillSyncFileName(String value) {
        return new JAXBElement<String>(_SendBillAttachmentAsyncFileName_QNAME, String.class, SendBillSync.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link byte[]}{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "contentFile", scope = SendBillSync.class)
    public JAXBElement<byte[]> createSendBillSyncContentFile(byte[] value) {
        return new JAXBElement<byte[]>(_SendBillAttachmentAsyncContentFile_QNAME, byte[].class, SendBillSync.class, ((byte[]) value));
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link TotalEImpuestos }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "TotalEImpuestos", scope = Documento.class)
    public JAXBElement<TotalEImpuestos> createDocumentoTotalEImpuestos(TotalEImpuestos value) {
        return new JAXBElement<TotalEImpuestos>(_DocumentoTotalEImpuestos_QNAME, TotalEImpuestos.class, Documento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link NumeroDocumento }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "NumeroDocumento", scope = Documento.class)
    public JAXBElement<NumeroDocumento> createDocumentoNumeroDocumento(NumeroDocumento value) {
        return new JAXBElement<NumeroDocumento>(_DocumentoNumeroDocumento_QNAME, NumeroDocumento.class, Documento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfNota }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "DocumentTags", scope = Documento.class)
    public JAXBElement<ArrayOfNota> createDocumentoDocumentTags(ArrayOfNota value) {
        return new JAXBElement<ArrayOfNota>(_DocumentoDocumentTags_QNAME, ArrayOfNota.class, Documento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "DocumentTypeId", scope = Documento.class)
    public JAXBElement<String> createDocumentoDocumentTypeId(String value) {
        return new JAXBElement<String>(_DocumentoDocumentTypeId_QNAME, String.class, Documento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfKeyValueOfintstring }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "Estado", scope = Documento.class)
    public JAXBElement<ArrayOfKeyValueOfintstring> createDocumentoEstado(ArrayOfKeyValueOfintstring value) {
        return new JAXBElement<ArrayOfKeyValueOfintstring>(_DocumentoEstado_QNAME, ArrayOfKeyValueOfintstring.class, Documento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link LegitimoTenedor }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "LegitimoTenedor", scope = Documento.class)
    public JAXBElement<LegitimoTenedor> createDocumentoLegitimoTenedor(LegitimoTenedor value) {
        return new JAXBElement<LegitimoTenedor>(_DocumentoLegitimoTenedor_QNAME, LegitimoTenedor.class, Documento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfValidacionDoc }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "ValidacionesDoc", scope = Documento.class)
    public JAXBElement<ArrayOfValidacionDoc> createDocumentoValidacionesDoc(ArrayOfValidacionDoc value) {
        return new JAXBElement<ArrayOfValidacionDoc>(_DocumentoValidacionesDoc_QNAME, ArrayOfValidacionDoc.class, Documento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Entidad }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "Emisor", scope = Documento.class)
    public JAXBElement<Entidad> createDocumentoEmisor(Entidad value) {
        return new JAXBElement<Entidad>(_DocumentoEmisor_QNAME, Entidad.class, Documento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "DocumentTypeName", scope = Documento.class)
    public JAXBElement<String> createDocumentoDocumentTypeName(String value) {
        return new JAXBElement<String>(_DocumentoDocumentTypeName_QNAME, String.class, Documento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "DocumentCode", scope = Documento.class)
    public JAXBElement<String> createDocumentoDocumentCode(String value) {
        return new JAXBElement<String>(_DocumentoDocumentCode_QNAME, String.class, Documento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "UUID", scope = Documento.class)
    public JAXBElement<String> createDocumentoUUID(String value) {
        return new JAXBElement<String>(_DocumentoUUID_QNAME, String.class, Documento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfEvento }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "Eventos", scope = Documento.class)
    public JAXBElement<ArrayOfEvento> createDocumentoEventos(ArrayOfEvento value) {
        return new JAXBElement<ArrayOfEvento>(_DocumentoEventos_QNAME, ArrayOfEvento.class, Documento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link ArrayOfReferenciaDocumento }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "Referencias", scope = Documento.class)
    public JAXBElement<ArrayOfReferenciaDocumento> createDocumentoReferencias(ArrayOfReferenciaDocumento value) {
        return new JAXBElement<ArrayOfReferenciaDocumento>(_DocumentoReferencias_QNAME, ArrayOfReferenciaDocumento.class, Documento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "DocumentDescription", scope = Documento.class)
    public JAXBElement<String> createDocumentoDocumentDescription(String value) {
        return new JAXBElement<String>(_DocumentoDocumentDescription_QNAME, String.class, Documento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link Entidad }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Documento", name = "Receptor", scope = Documento.class)
    public JAXBElement<Entidad> createDocumentoReceptor(Entidad value) {
        return new JAXBElement<Entidad>(_DocumentoReceptor_QNAME, Entidad.class, Documento.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "trackId", scope = GetStatus.class)
    public JAXBElement<String> createGetStatusTrackId(String value) {
        return new JAXBElement<String>(_GetReferenceNotesTrackId_QNAME, String.class, GetStatus.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link UploadDocumentResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "SendBillAttachmentAsyncResult", scope = SendBillAttachmentAsyncResponse.class)
    public JAXBElement<UploadDocumentResponse> createSendBillAttachmentAsyncResponseSendBillAttachmentAsyncResult(UploadDocumentResponse value) {
        return new JAXBElement<UploadDocumentResponse>(_SendBillAttachmentAsyncResponseSendBillAttachmentAsyncResult_QNAME, UploadDocumentResponse.class, SendBillAttachmentAsyncResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link DianResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "GetStatusEventResult", scope = GetStatusEventResponse.class)
    public JAXBElement<DianResponse> createGetStatusEventResponseGetStatusEventResult(DianResponse value) {
        return new JAXBElement<DianResponse>(_GetStatusEventResponseGetStatusEventResult_QNAME, DianResponse.class, GetStatusEventResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Entidad", name = "Procedencia", scope = Entidad.class)
    public JAXBElement<String> createEntidadProcedencia(String value) {
        return new JAXBElement<String>(_EntidadProcedencia_QNAME, String.class, Entidad.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Entidad", name = "NumeroDoc", scope = Entidad.class)
    public JAXBElement<String> createEntidadNumeroDoc(String value) {
        return new JAXBElement<String>(_EntidadNumeroDoc_QNAME, String.class, Entidad.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Entidad", name = "Nombre", scope = Entidad.class)
    public JAXBElement<String> createEntidadNombre(String value) {
        return new JAXBElement<String>(_EntidadNombre_QNAME, String.class, Entidad.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Entidad", name = "TipoDoc", scope = Entidad.class)
    public JAXBElement<String> createEntidadTipoDoc(String value) {
        return new JAXBElement<String>(_EntidadTipoDoc_QNAME, String.class, Entidad.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link DianResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "GetStatusResult", scope = GetStatusResponse.class)
    public JAXBElement<DianResponse> createGetStatusResponseGetStatusResult(DianResponse value) {
        return new JAXBElement<DianResponse>(_GetStatusResponseGetStatusResult_QNAME, DianResponse.class, GetStatusResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link DocumentInfoResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "GetDocumentInfoResult", scope = GetDocumentInfoResponse.class)
    public JAXBElement<DocumentInfoResponse> createGetDocumentInfoResponseGetDocumentInfoResult(DocumentInfoResponse value) {
        return new JAXBElement<DocumentInfoResponse>(_GetDocumentInfoResponseGetDocumentInfoResult_QNAME, DocumentInfoResponse.class, GetDocumentInfoResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link DianResponse }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "SendNominaSyncResult", scope = SendNominaSyncResponse.class)
    public JAXBElement<DianResponse> createSendNominaSyncResponseSendNominaSyncResult(DianResponse value) {
        return new JAXBElement<DianResponse>(_SendNominaSyncResponseSendNominaSyncResult_QNAME, DianResponse.class, SendNominaSyncResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Gosocket.Dian.Services.Utils.Common", name = "Message", scope = AdquirienteResponse.class)
    public JAXBElement<String> createAdquirienteResponseMessage(String value) {
        return new JAXBElement<String>(_AdquirienteResponseMessage_QNAME, String.class, AdquirienteResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Gosocket.Dian.Services.Utils.Common", name = "ReceiverEmail", scope = AdquirienteResponse.class)
    public JAXBElement<String> createAdquirienteResponseReceiverEmail(String value) {
        return new JAXBElement<String>(_AdquirienteResponseReceiverEmail_QNAME, String.class, AdquirienteResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Gosocket.Dian.Services.Utils.Common", name = "ReceiverName", scope = AdquirienteResponse.class)
    public JAXBElement<String> createAdquirienteResponseReceiverName(String value) {
        return new JAXBElement<String>(_AdquirienteResponseReceiverName_QNAME, String.class, AdquirienteResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://schemas.datacontract.org/2004/07/Gosocket.Dian.Services.Utils.Common", name = "StatusCode", scope = AdquirienteResponse.class)
    public JAXBElement<String> createAdquirienteResponseStatusCode(String value) {
        return new JAXBElement<String>(_AdquirienteResponseStatusCode_QNAME, String.class, AdquirienteResponse.class, value);
    }

    /**
     * Create an instance of {@link JAXBElement }{@code <}{@link String }{@code >}}
     * 
     */
    @XmlElementDecl(namespace = "http://wcf.dian.colombia", name = "trackId", scope = GetXmlByDocumentKey.class)
    public JAXBElement<String> createGetXmlByDocumentKeyTrackId(String value) {
        return new JAXBElement<String>(_GetReferenceNotesTrackId_QNAME, String.class, GetXmlByDocumentKey.class, value);
    }

}
