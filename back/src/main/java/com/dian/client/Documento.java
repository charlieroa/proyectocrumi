
package com.dian.client;

import javax.xml.bind.JAXBElement;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElementRef;
import javax.xml.bind.annotation.XmlType;


/**
 * <p>Java class for Documento complex type.
 * 
 * <p>The following schema fragment specifies the expected content contained within this class.
 * 
 * <pre>
 * &lt;complexType name="Documento">
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element name="DocumentCode" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="DocumentDescription" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="DocumentTags" type="{http://schemas.datacontract.org/2004/07/Nota}ArrayOfNota" minOccurs="0"/>
 *         &lt;element name="DocumentTypeId" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="DocumentTypeName" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="Emisor" type="{http://schemas.datacontract.org/2004/07/Entidad}Entidad" minOccurs="0"/>
 *         &lt;element name="Estado" type="{http://schemas.microsoft.com/2003/10/Serialization/Arrays}ArrayOfKeyValueOfintstring" minOccurs="0"/>
 *         &lt;element name="Eventos" type="{http://schemas.datacontract.org/2004/07/Evento}ArrayOfEvento" minOccurs="0"/>
 *         &lt;element name="LegitimoTenedor" type="{http://schemas.datacontract.org/2004/07/LegitimoTenedor}LegitimoTenedor" minOccurs="0"/>
 *         &lt;element name="NumeroDocumento" type="{http://schemas.datacontract.org/2004/07/NumeroDocumento}NumeroDocumento" minOccurs="0"/>
 *         &lt;element name="Receptor" type="{http://schemas.datacontract.org/2004/07/Entidad}Entidad" minOccurs="0"/>
 *         &lt;element name="Referencias" type="{http://schemas.datacontract.org/2004/07/ReferenciaDocumento}ArrayOfReferenciaDocumento" minOccurs="0"/>
 *         &lt;element name="TotalEImpuestos" type="{http://schemas.datacontract.org/2004/07/TotalEImpuestos}TotalEImpuestos" minOccurs="0"/>
 *         &lt;element name="UUID" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="ValidacionesDoc" type="{http://schemas.datacontract.org/2004/07/ValidacionDoc}ArrayOfValidacionDoc" minOccurs="0"/>
 *       &lt;/sequence>
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "Documento", namespace = "http://schemas.datacontract.org/2004/07/Documento", propOrder = {
    "documentCode",
    "documentDescription",
    "documentTags",
    "documentTypeId",
    "documentTypeName",
    "emisor",
    "estado",
    "eventos",
    "legitimoTenedor",
    "numeroDocumento",
    "receptor",
    "referencias",
    "totalEImpuestos",
    "uuid",
    "validacionesDoc"
})
public class Documento {

    @XmlElementRef(name = "DocumentCode", namespace = "http://schemas.datacontract.org/2004/07/Documento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> documentCode;
    @XmlElementRef(name = "DocumentDescription", namespace = "http://schemas.datacontract.org/2004/07/Documento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> documentDescription;
    @XmlElementRef(name = "DocumentTags", namespace = "http://schemas.datacontract.org/2004/07/Documento", type = JAXBElement.class, required = false)
    protected JAXBElement<ArrayOfNota> documentTags;
    @XmlElementRef(name = "DocumentTypeId", namespace = "http://schemas.datacontract.org/2004/07/Documento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> documentTypeId;
    @XmlElementRef(name = "DocumentTypeName", namespace = "http://schemas.datacontract.org/2004/07/Documento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> documentTypeName;
    @XmlElementRef(name = "Emisor", namespace = "http://schemas.datacontract.org/2004/07/Documento", type = JAXBElement.class, required = false)
    protected JAXBElement<Entidad> emisor;
    @XmlElementRef(name = "Estado", namespace = "http://schemas.datacontract.org/2004/07/Documento", type = JAXBElement.class, required = false)
    protected JAXBElement<ArrayOfKeyValueOfintstring> estado;
    @XmlElementRef(name = "Eventos", namespace = "http://schemas.datacontract.org/2004/07/Documento", type = JAXBElement.class, required = false)
    protected JAXBElement<ArrayOfEvento> eventos;
    @XmlElementRef(name = "LegitimoTenedor", namespace = "http://schemas.datacontract.org/2004/07/Documento", type = JAXBElement.class, required = false)
    protected JAXBElement<LegitimoTenedor> legitimoTenedor;
    @XmlElementRef(name = "NumeroDocumento", namespace = "http://schemas.datacontract.org/2004/07/Documento", type = JAXBElement.class, required = false)
    protected JAXBElement<NumeroDocumento> numeroDocumento;
    @XmlElementRef(name = "Receptor", namespace = "http://schemas.datacontract.org/2004/07/Documento", type = JAXBElement.class, required = false)
    protected JAXBElement<Entidad> receptor;
    @XmlElementRef(name = "Referencias", namespace = "http://schemas.datacontract.org/2004/07/Documento", type = JAXBElement.class, required = false)
    protected JAXBElement<ArrayOfReferenciaDocumento> referencias;
    @XmlElementRef(name = "TotalEImpuestos", namespace = "http://schemas.datacontract.org/2004/07/Documento", type = JAXBElement.class, required = false)
    protected JAXBElement<TotalEImpuestos> totalEImpuestos;
    @XmlElementRef(name = "UUID", namespace = "http://schemas.datacontract.org/2004/07/Documento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> uuid;
    @XmlElementRef(name = "ValidacionesDoc", namespace = "http://schemas.datacontract.org/2004/07/Documento", type = JAXBElement.class, required = false)
    protected JAXBElement<ArrayOfValidacionDoc> validacionesDoc;

    /**
     * Gets the value of the documentCode property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getDocumentCode() {
        return documentCode;
    }

    /**
     * Sets the value of the documentCode property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setDocumentCode(JAXBElement<String> value) {
        this.documentCode = value;
    }

    /**
     * Gets the value of the documentDescription property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getDocumentDescription() {
        return documentDescription;
    }

    /**
     * Sets the value of the documentDescription property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setDocumentDescription(JAXBElement<String> value) {
        this.documentDescription = value;
    }

    /**
     * Gets the value of the documentTags property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfNota }{@code >}
     *     
     */
    public JAXBElement<ArrayOfNota> getDocumentTags() {
        return documentTags;
    }

    /**
     * Sets the value of the documentTags property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfNota }{@code >}
     *     
     */
    public void setDocumentTags(JAXBElement<ArrayOfNota> value) {
        this.documentTags = value;
    }

    /**
     * Gets the value of the documentTypeId property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getDocumentTypeId() {
        return documentTypeId;
    }

    /**
     * Sets the value of the documentTypeId property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setDocumentTypeId(JAXBElement<String> value) {
        this.documentTypeId = value;
    }

    /**
     * Gets the value of the documentTypeName property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getDocumentTypeName() {
        return documentTypeName;
    }

    /**
     * Sets the value of the documentTypeName property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setDocumentTypeName(JAXBElement<String> value) {
        this.documentTypeName = value;
    }

    /**
     * Gets the value of the emisor property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public JAXBElement<Entidad> getEmisor() {
        return emisor;
    }

    /**
     * Sets the value of the emisor property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public void setEmisor(JAXBElement<Entidad> value) {
        this.emisor = value;
    }

    /**
     * Gets the value of the estado property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfKeyValueOfintstring }{@code >}
     *     
     */
    public JAXBElement<ArrayOfKeyValueOfintstring> getEstado() {
        return estado;
    }

    /**
     * Sets the value of the estado property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfKeyValueOfintstring }{@code >}
     *     
     */
    public void setEstado(JAXBElement<ArrayOfKeyValueOfintstring> value) {
        this.estado = value;
    }

    /**
     * Gets the value of the eventos property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfEvento }{@code >}
     *     
     */
    public JAXBElement<ArrayOfEvento> getEventos() {
        return eventos;
    }

    /**
     * Sets the value of the eventos property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfEvento }{@code >}
     *     
     */
    public void setEventos(JAXBElement<ArrayOfEvento> value) {
        this.eventos = value;
    }

    /**
     * Gets the value of the legitimoTenedor property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link LegitimoTenedor }{@code >}
     *     
     */
    public JAXBElement<LegitimoTenedor> getLegitimoTenedor() {
        return legitimoTenedor;
    }

    /**
     * Sets the value of the legitimoTenedor property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link LegitimoTenedor }{@code >}
     *     
     */
    public void setLegitimoTenedor(JAXBElement<LegitimoTenedor> value) {
        this.legitimoTenedor = value;
    }

    /**
     * Gets the value of the numeroDocumento property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link NumeroDocumento }{@code >}
     *     
     */
    public JAXBElement<NumeroDocumento> getNumeroDocumento() {
        return numeroDocumento;
    }

    /**
     * Sets the value of the numeroDocumento property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link NumeroDocumento }{@code >}
     *     
     */
    public void setNumeroDocumento(JAXBElement<NumeroDocumento> value) {
        this.numeroDocumento = value;
    }

    /**
     * Gets the value of the receptor property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public JAXBElement<Entidad> getReceptor() {
        return receptor;
    }

    /**
     * Sets the value of the receptor property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public void setReceptor(JAXBElement<Entidad> value) {
        this.receptor = value;
    }

    /**
     * Gets the value of the referencias property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfReferenciaDocumento }{@code >}
     *     
     */
    public JAXBElement<ArrayOfReferenciaDocumento> getReferencias() {
        return referencias;
    }

    /**
     * Sets the value of the referencias property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfReferenciaDocumento }{@code >}
     *     
     */
    public void setReferencias(JAXBElement<ArrayOfReferenciaDocumento> value) {
        this.referencias = value;
    }

    /**
     * Gets the value of the totalEImpuestos property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link TotalEImpuestos }{@code >}
     *     
     */
    public JAXBElement<TotalEImpuestos> getTotalEImpuestos() {
        return totalEImpuestos;
    }

    /**
     * Sets the value of the totalEImpuestos property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link TotalEImpuestos }{@code >}
     *     
     */
    public void setTotalEImpuestos(JAXBElement<TotalEImpuestos> value) {
        this.totalEImpuestos = value;
    }

    /**
     * Gets the value of the uuid property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getUUID() {
        return uuid;
    }

    /**
     * Sets the value of the uuid property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setUUID(JAXBElement<String> value) {
        this.uuid = value;
    }

    /**
     * Gets the value of the validacionesDoc property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfValidacionDoc }{@code >}
     *     
     */
    public JAXBElement<ArrayOfValidacionDoc> getValidacionesDoc() {
        return validacionesDoc;
    }

    /**
     * Sets the value of the validacionesDoc property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfValidacionDoc }{@code >}
     *     
     */
    public void setValidacionesDoc(JAXBElement<ArrayOfValidacionDoc> value) {
        this.validacionesDoc = value;
    }

}
